/* Probe only: synchronous, bounded inputs, macOS only. Not a product addon. */
#include <node_api.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <dirent.h>
#include <unistd.h>
#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#if !defined(__APPLE__) || !defined(O_NOFOLLOW_ANY)
#error Unsupported probe platform
#endif

static int held = 0, reads = 0, listings = 0;
static napi_value fail(napi_env env, const char *op) {
  char message[128];
  snprintf(message, sizeof(message), "%s: errno=%d %s", op, errno, strerror(errno));
  napi_throw_error(env, NULL, message);
  return NULL;
}
static napi_value number(napi_env env, int n) {
  napi_value value; napi_create_int32(env, n, &value); return value;
}
static napi_value args(napi_env env, napi_callback_info info, napi_value *a, size_t n) {
  size_t count = n;
  if (napi_get_cb_info(env, info, &count, a, NULL, NULL) != napi_ok || count != n) {
    napi_throw_type_error(env, NULL, "wrong arguments"); return NULL;
  }
  return a[0];
}
static int string(napi_env env, napi_value value, char *out, size_t capacity) {
  size_t length;
  if (napi_get_value_string_utf8(env, value, NULL, 0, &length) != napi_ok || length >= capacity) return 0;
  if (napi_get_value_string_utf8(env, value, out, capacity, &length) != napi_ok) return 0;
  return strlen(out) == length;
}
static napi_value root(napi_env env, napi_callback_info info) {
  napi_value a[1]; char path[4096];
  if (!args(env, info, a, 1)) return NULL;
  if (!string(env, a[0], path, sizeof(path)) || path[0] != '/') { errno = EINVAL; return fail(env, "root input"); }
  int fd = open(path, O_RDONLY | O_DIRECTORY | O_NOFOLLOW_ANY | O_CLOEXEC);
  if (fd < 0) return fail(env, "root open");
  held++; return number(env, fd);
}
static napi_value relative(napi_env env, napi_callback_info info) {
  napi_value a[3]; char path[4096], copy[4096]; int fd; bool directory;
  if (!args(env, info, a, 3)) return NULL;
  if (napi_get_value_int32(env, a[0], &fd) != napi_ok ||
      napi_get_value_bool(env, a[2], &directory) != napi_ok ||
      !string(env, a[1], path, sizeof(path)) || !path[0] || path[0] == '/') {
    errno = EINVAL; return fail(env, "relative input");
  }
  strcpy(copy, path); char *save;
  for (char *part = strtok_r(copy, "/", &save); part; part = strtok_r(NULL, "/", &save)) {
    if (!strcmp(part, ".") || !strcmp(part, "..")) { errno = EINVAL; return fail(env, "relative component"); }
  }
  int next = openat(fd, path, O_RDONLY | O_NOFOLLOW_ANY | O_CLOEXEC | O_NONBLOCK | (directory ? O_DIRECTORY : 0));
  if (next < 0) return fail(env, "openat");
  struct stat st;
  if (fstat(next, &st) < 0 || !(directory ? S_ISDIR(st.st_mode) : S_ISREG(st.st_mode))) {
    close(next); errno = EINVAL; return fail(env, "type");
  }
  held++; return number(env, next);
}
static napi_value read_fd(napi_env env, napi_callback_info info) {
  napi_value a[1], result; int fd; unsigned char bytes[65536];
  if (!args(env, info, a, 1)) return NULL;
  napi_get_value_int32(env, a[0], &fd);
  ssize_t size = pread(fd, bytes, sizeof(bytes), 0);
  if (size < 0) return fail(env, "pread");
  reads++;
  napi_create_buffer_copy(env, (size_t)size, bytes, NULL, &result);
  return result;
}
static napi_value list_fd(napi_env env, napi_callback_info info) {
  napi_value a[1], result; int fd;
  if (!args(env, info, a, 1)) return NULL;
  napi_get_value_int32(env, a[0], &fd);
  /* openat(".") creates a separate directory offset, unlike dup. */
  int copy = openat(fd, ".", O_RDONLY | O_DIRECTORY | O_NOFOLLOW_ANY | O_CLOEXEC);
  if (copy < 0) return fail(env, "list openat");
  DIR *dir = fdopendir(copy);
  if (!dir) { int code = errno; close(copy); errno = code; return fail(env, "fdopendir"); }
  napi_create_array(env, &result);
  unsigned index = 0; int code = 0;
  for (;;) {
    errno = 0; struct dirent *entry = readdir(dir);
    if (!entry) { code = errno; break; }
    if (!strcmp(entry->d_name, ".") || !strcmp(entry->d_name, "..")) continue;
    listings++;
    /* Names are already from the held directory. Classify without following. */
    struct stat st;
    if (fstatat(copy, entry->d_name, &st, AT_SYMLINK_NOFOLLOW) < 0) { code = errno; break; }
    if (!S_ISREG(st.st_mode) && !S_ISDIR(st.st_mode)) continue;
    napi_value row, name, type;
    napi_create_object(env, &row);
    napi_create_string_utf8(env, entry->d_name, NAPI_AUTO_LENGTH, &name);
    napi_create_string_utf8(env, S_ISDIR(st.st_mode) ? "directory" : "file", NAPI_AUTO_LENGTH, &type);
    napi_set_named_property(env, row, "name", name);
    napi_set_named_property(env, row, "type", type);
    napi_set_element(env, result, index++, row);
  }
  if (closedir(dir) < 0 && !code) code = errno;
  if (code) { errno = code; return fail(env, "listing"); }
  return result;
}
static napi_value close_fd(napi_env env, napi_callback_info info) {
  napi_value a[1]; int fd;
  if (!args(env, info, a, 1)) return NULL;
  napi_get_value_int32(env, a[0], &fd);
  if (close(fd) < 0) return fail(env, "close");
  held--; return number(env, held);
}
static napi_value counters(napi_env env, napi_callback_info info) {
  (void)info;
  napi_value value; napi_create_object(env, &value);
  napi_set_named_property(env, value, "held", number(env, held));
  napi_set_named_property(env, value, "reads", number(env, reads));
  napi_set_named_property(env, value, "entries", number(env, listings));
  return value;
}
static napi_value init(napi_env env, napi_value exports) {
  napi_property_descriptor methods[] = {
    {"root", NULL, root, NULL, NULL, NULL, napi_default, NULL},
    {"relative", NULL, relative, NULL, NULL, NULL, napi_default, NULL},
    {"read", NULL, read_fd, NULL, NULL, NULL, napi_default, NULL},
    {"list", NULL, list_fd, NULL, NULL, NULL, napi_default, NULL},
    {"close", NULL, close_fd, NULL, NULL, NULL, napi_default, NULL},
    {"counters", NULL, counters, NULL, NULL, NULL, napi_default, NULL},
  };
  napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods);
  return exports;
}
NAPI_MODULE(m6_reader_probe, init)
