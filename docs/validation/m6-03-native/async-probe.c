#include <node_api.h>
#include <stdatomic.h>
#include <stdlib.h>
#include <unistd.h>
typedef struct { napi_async_work work; napi_deferred done; atomic_int cancelled; } Job;
static void execute(napi_env env, void *data) { (void)env; Job *j=data; for(int i=0;i<100&&!atomic_load(&j->cancelled);i++) usleep(1000); }
static void complete(napi_env env,napi_status status,void *data) { Job*j=data; napi_value v; napi_create_int32(env,status==napi_cancelled?2:atomic_load(&j->cancelled),&v); napi_resolve_deferred(env,j->done,v); napi_delete_async_work(env,j->work); free(j); }
static napi_value run(napi_env env,napi_callback_info info) { (void)info; Job*j=calloc(1,sizeof(Job)); napi_value name,promise; napi_create_string_utf8(env,"probe",NAPI_AUTO_LENGTH,&name); napi_create_promise(env,&j->done,&promise); napi_create_async_work(env,NULL,name,execute,complete,j,&j->work); napi_queue_async_work(env,j->work); atomic_store(&j->cancelled,1); napi_cancel_async_work(env,j->work); return promise; }
NAPI_MODULE_INIT(){ napi_value fn; napi_create_function(env,"run",NAPI_AUTO_LENGTH,run,NULL,&fn); napi_set_named_property(env,exports,"run",fn); return exports; }
