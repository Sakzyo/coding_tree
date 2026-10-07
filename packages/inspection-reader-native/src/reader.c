#include <node_api.h>
#include <stdatomic.h>
#include <sys/stat.h>
#include <sys/sysctl.h>
#include <fcntl.h>
#include <dirent.h>
#include <unistd.h>
#include <errno.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <limits.h>

#if !defined(__APPLE__) || !defined(__aarch64__) || !defined(O_NOFOLLOW_ANY)
#error Unverified protected reader platform
#endif

#define CHUNK 65536
#define ENTRIES 128
static const napi_type_tag resource_tag = {0x7bab21c4d0538e12ULL, 0x48cf37bde59a6210ULL};
typedef struct Job Job;
typedef struct Waiter { napi_deferred done; struct Waiter *next; } Waiter;
typedef struct {
  int fd, kind, closing, active;
  DIR *dir;
  off_t offset;
  struct stat identity;
  char requested[PATH_MAX], canonical[PATH_MAX];
  Job *jobs;
  Waiter *waiters;
} Resource;
struct Job {
  napi_async_work work;
  napi_deferred done;
  napi_ref self, owner;
  Resource *resource, *created;
  Job *next;
  atomic_int cancelled;
  int operation, kind, finished, missing, references;
  const char *error;
  char path[PATH_MAX];
  unsigned char bytes[CHUNK];
  size_t length, count;
  struct { char name[NAME_MAX + 1]; int kind; } entries[ENTRIES];
};

static napi_value undefined(napi_env env) { napi_value v; napi_get_undefined(env, &v); return v; }
static napi_value text(napi_env env, const char *s) { napi_value v; napi_create_string_utf8(env,s,NAPI_AUTO_LENGTH,&v); return v; }
static napi_value error(napi_env env, const char *code) {
  napi_value v; napi_create_error(env,NULL,text(env,code),&v);
  napi_set_named_property(env,v,"code",text(env,code)); return v;
}
static const char *failure(int code) {
  if (code == ELOOP || code == ENOTDIR) return "path_outside_project";
  return "file_unavailable";
}
static int string(napi_env env, napi_value v, char *out) {
  size_t size;
  return napi_get_value_string_utf8(env,v,NULL,0,&size)==napi_ok && size<PATH_MAX &&
    napi_get_value_string_utf8(env,v,out,PATH_MAX,&size)==napi_ok && strlen(out)==size;
}
static int relative(const char *s) {
  if (!*s || *s=='/' || strchr(s,'\\')) return 0;
  const char *p=s;
  while (1) {
    const char *end=strchr(p,'/'); size_t n=end ? (size_t)(end-p) : strlen(p);
    if (!n || (n==1 && *p=='.') || (n==2 && p[0]=='.' && p[1]=='.')) return 0;
    if (!end) return 1;
    p=end+1;
  }
}
static int identity(const struct stat *a,const struct stat *b) { return a->st_dev==b->st_dev && a->st_ino==b->st_ino; }
static int unchanged(Resource *r) {
  struct stat s;
  return fstat(r->fd,&s)==0 && identity(&s,&r->identity) && s.st_size==r->identity.st_size &&
    s.st_mtimespec.tv_sec==r->identity.st_mtimespec.tv_sec && s.st_mtimespec.tv_nsec==r->identity.st_mtimespec.tv_nsec;
}
static void release(Resource *r) {
  if (r->dir) { closedir(r->dir); r->dir=NULL; r->fd=-1; }
  if (r->fd>=0) { close(r->fd); r->fd=-1; }
}
static void finalize_resource(napi_env env, void *data, void *hint) {
  (void)env; (void)hint; Resource *r=data; release(r); free(r);
}
static napi_value wrap(napi_env env,Resource *r) {
  napi_value v; napi_create_object(env,&v);
  napi_wrap(env,v,r,finalize_resource,NULL,NULL); napi_type_tag_object(env,v,&resource_tag);
  if(r->kind==0) {
    char id[80]; snprintf(id,sizeof(id),"%llu:%llu",(unsigned long long)r->identity.st_dev,(unsigned long long)r->identity.st_ino);
    napi_set_named_property(env,v,"canonicalRoot",text(env,r->canonical));
    napi_set_named_property(env,v,"identity",text(env,id));
  }
  return v;
}
static Resource *unwrap(napi_env env,napi_value v) {
  bool valid=false; Resource *r=NULL;
  if(napi_check_object_type_tag(env,v,&resource_tag,&valid)!=napi_ok || !valid || napi_unwrap(env,v,(void**)&r)!=napi_ok) {
    napi_throw_type_error(env,NULL,"Invalid native resource"); return NULL;
  }
  return r;
}
static void retire(napi_env env,Resource *r) {
  if (!r->closing || r->active) return;
  release(r);
  while(r->waiters) {
    Waiter *w=r->waiters; r->waiters=w->next;
    napi_resolve_deferred(env,w->done,undefined(env)); free(w);
  }
}
static void execute(napi_env env,void *data) {
  (void)env; Job *j=data; Resource *r=j->resource;
  if(atomic_load(&j->cancelled)) return;
  if(j->operation==0) {
    Resource *created=calloc(1,sizeof(Resource));
    if(!created) { j->error="reader_unavailable"; return; }
    created->fd=-1; j->created=created;
    strcpy(created->requested,j->path);
    if(!realpath(j->path,created->canonical)) { j->error=failure(errno); return; }
    created->fd=open(created->canonical,O_RDONLY|O_DIRECTORY|O_NOFOLLOW_ANY|O_CLOEXEC|O_NONBLOCK);
    struct stat alias,canonical;
    if(created->fd<0 || fstat(created->fd,&created->identity)<0) { j->error=failure(errno); return; }
    if(stat(created->requested,&alias)<0 || stat(created->canonical,&canonical)<0 ||
       !identity(&alias,&created->identity) || !identity(&canonical,&created->identity)) j->error="path_outside_project";
    return;
  }
  if(j->operation==1) {
    int fd=openat(r->fd,j->path,O_RDONLY|O_NOFOLLOW_ANY|O_CLOEXEC|O_NONBLOCK|(j->kind==2?O_DIRECTORY:0));
    if(fd<0) { if(errno==ENOENT) j->missing=1; else j->error=failure(errno); return; }
    struct stat s;
    if(fstat(fd,&s)<0 || !(j->kind==2?S_ISDIR(s.st_mode):S_ISREG(s.st_mode))) { close(fd); j->error="file_unavailable"; return; }
    Resource *created=calloc(1,sizeof(Resource));
    if(!created) { close(fd); j->error="reader_unavailable"; return; }
    created->fd=fd; created->kind=j->kind; created->identity=s; j->created=created;
    if(j->kind==2) {
      created->dir=fdopendir(fd);
      if(!created->dir) j->error="file_unavailable";
    }
    return;
  }
  if(j->operation==2) {
    if(!unchanged(r)) { j->error="file_unavailable"; return; }
    ssize_t n;
    do { n=pread(r->fd,j->bytes,CHUNK,r->offset); } while(n<0 && errno==EINTR && !atomic_load(&j->cancelled));
    if(n<0 || !unchanged(r)) { j->error="file_unavailable"; return; }
    j->length=(size_t)n; r->offset+=n; return;
  }
  if(j->operation==3) {
    if(!unchanged(r)) { j->error="file_unavailable"; return; }
    while(j->count<ENTRIES && !atomic_load(&j->cancelled)) {
      errno=0; struct dirent *entry=readdir(r->dir);
      if(!entry) { if(errno) j->error="file_unavailable"; break; }
      if(!strcmp(entry->d_name,".") || !strcmp(entry->d_name,"..")) continue;
      struct stat s;
      if(fstatat(r->fd,entry->d_name,&s,AT_SYMLINK_NOFOLLOW)<0) { j->error="file_unavailable"; break; }
      if(!S_ISREG(s.st_mode) && !S_ISDIR(s.st_mode)) { j->error=S_ISLNK(s.st_mode)?"path_outside_project":"file_unavailable"; break; }
      strcpy(j->entries[j->count].name,entry->d_name);
      j->entries[j->count++].kind=S_ISDIR(s.st_mode)?2:1;
    }
    if(!unchanged(r)) j->error="file_unavailable";
    return;
  }
  struct stat alias,canonical;
  if(stat(r->requested,&alias)<0 || stat(r->canonical,&canonical)<0 ||
     !identity(&alias,&r->identity) || !identity(&canonical,&r->identity)) j->error="path_outside_project";
}
static void complete(napi_env env,napi_status status,void *data) {
  Job *j=data; napi_value value=undefined(env);
  j->finished=1;
  if(status==napi_cancelled || atomic_load(&j->cancelled)) j->error="cancelled";
  if(!j->error && !j->missing) {
    if(j->created) { value=wrap(env,j->created); j->created=NULL; }
    if(j->operation==2) napi_create_buffer_copy(env,j->length,j->bytes,NULL,&value);
    if(j->operation==3) {
      napi_create_array_with_length(env,j->count,&value);
      for(size_t i=0;i<j->count;i++) {
        napi_value entry; napi_create_object(env,&entry);
        napi_set_named_property(env,entry,"name",text(env,j->entries[i].name));
        napi_set_named_property(env,entry,"type",text(env,j->entries[i].kind==2?"directory":"file"));
        napi_set_element(env,value,(uint32_t)i,entry);
      }
    }
  }
  if(j->created) { release(j->created); free(j->created); j->created=NULL; }
  if(j->error) napi_reject_deferred(env,j->done,error(env,j->error));
  else napi_resolve_deferred(env,j->done,value);
  if(j->resource) {
    Job **p=&j->resource->jobs; while(*p && *p!=j) p=&(*p)->next;
    if(*p) *p=j->next;
    j->resource->active--; retire(env,j->resource);
  }
  napi_delete_async_work(env,j->work);
  if(j->owner) napi_delete_reference(env,j->owner);
  napi_delete_reference(env,j->self);
}
static void finalize_job(napi_env env,void *data,void *hint) { (void)env; (void)hint; Job *j=data; if(--j->references==0) free(j); }
static napi_value cancel(napi_env env,napi_callback_info info) {
  Job *j; napi_get_cb_info(env,info,NULL,NULL,NULL,(void**)&j);
  if(!j->finished) { atomic_store(&j->cancelled,1); napi_cancel_async_work(env,j->work); }
  return undefined(env);
}
static napi_value start(napi_env env,napi_callback_info info) {
  napi_value args[3], owner=NULL; size_t count=3; void *data;
  napi_get_cb_info(env,info,&count,args,NULL,&data);
  int operation=(int)(intptr_t)data;
  Resource *r=NULL; char input[PATH_MAX]={0}; int kind=0;
  if(operation==0) {
    if(count!=1 || !string(env,args[0],input) || input[0]!='/') { napi_throw(env,error(env,"path_outside_project")); return NULL; }
  } else {
    if(!count) { napi_throw_type_error(env,NULL,"Missing native resource"); return NULL; }
    if(!(r=unwrap(env,args[0]))) return NULL;
    owner=args[0];
    if(operation==1) {
      char type[PATH_MAX];
      if(count!=3 || r->kind!=0 || !string(env,args[1],input) || !relative(input) || !string(env,args[2],type) ||
         (strcmp(type,"file") && strcmp(type,"directory"))) { napi_throw(env,error(env,"path_outside_project")); return NULL; }
      kind=!strcmp(type,"file")?1:2;
    } else if(count!=1 || r->kind!=(operation==2?1:operation==3?2:0)) { napi_throw_type_error(env,NULL,"Wrong resource kind"); return NULL; }
  }
  Job *j=calloc(1,sizeof(Job));
  if(!j) { napi_throw(env,error(env,"reader_unavailable")); return NULL; }
  j->references=2; j->operation=operation; j->resource=r; j->kind=kind; strcpy(j->path,input);
  napi_value object,promise,fn;
  napi_create_object(env,&object); napi_create_promise(env,&j->done,&promise);
  napi_wrap(env,object,j,finalize_job,NULL,NULL);
  napi_create_function(env,"cancel",NAPI_AUTO_LENGTH,cancel,j,&fn);
  // Both wrappers own the job; an escaped cancel function cannot reference freed storage.
  napi_add_finalizer(env,fn,j,finalize_job,NULL,NULL);
  napi_set_named_property(env,object,"cancel",fn); napi_set_named_property(env,object,"promise",promise);
  if(r && (r->closing || (r->kind!=0 && r->active))) {
    j->finished=1; napi_reject_deferred(env,j->done,error(env,r->closing?"owner_closed":"reader_unavailable")); return object;
  }
  napi_status status=napi_create_async_work(env,NULL,text(env,"inspection-reader"),execute,complete,j,&j->work);
  if(status!=napi_ok) { j->finished=1; napi_reject_deferred(env,j->done,error(env,"reader_unavailable")); return object; }
  napi_create_reference(env,object,1,&j->self);
  if(r) { napi_create_reference(env,owner,1,&j->owner); r->active++; j->next=r->jobs; r->jobs=j; }
  if(napi_queue_async_work(env,j->work)!=napi_ok) { j->error="reader_unavailable"; complete(env,napi_ok,j); }
  return object;
}
static napi_value close_resource(napi_env env,napi_callback_info info) {
  size_t count=1; napi_value value; napi_get_cb_info(env,info,&count,&value,NULL,NULL);
  if(!count) { napi_throw_type_error(env,NULL,"Missing native resource"); return NULL; }
  Resource *r=unwrap(env,value); if(!r) return NULL;
  Waiter *w=calloc(1,sizeof(Waiter));
  if(!w) { napi_throw(env,error(env,"reader_unavailable")); return NULL; }
  napi_value promise; napi_create_promise(env,&w->done,&promise); w->next=r->waiters; r->waiters=w;
  r->closing=1;
  for(Job *j=r->jobs;j;j=j->next) { atomic_store(&j->cancelled,1); napi_cancel_async_work(env,j->work); }
  retire(env,r); return promise;
}
NAPI_MODULE_INIT() {
  // The current binary is verified on one host build only; this is not an OS minimum claim.
  char build[64]; size_t length=sizeof(build);
  if(sysctlbyname("kern.osversion",build,&length,NULL,0)!=0 || strcmp(build,"25F84")) {
    napi_throw(env,error(env,"unsupported_reader")); return NULL;
  }
  const char *names[]={"root","open","read","list","verify"};
  for(int i=0;i<5;i++) { napi_value fn; napi_create_function(env,names[i],NAPI_AUTO_LENGTH,start,(void*)(intptr_t)i,&fn); napi_set_named_property(env,exports,names[i],fn); }
  napi_value fn; napi_create_function(env,"close",NAPI_AUTO_LENGTH,close_resource,NULL,&fn); napi_set_named_property(env,exports,"close",fn);
  return exports;
}
