/* Scheduling/lifetime probe only; no product reader authority. */
#include <node_api.h>
#include <stdatomic.h>
#include <stdlib.h>
#include <unistd.h>
typedef struct { napi_async_work work; napi_deferred done; napi_ref self; atomic_int cancelled,started; int complete; } Job;
static void execute(napi_env env,void*data){(void)env;Job*j=data;atomic_store(&j->started,1);while(!atomic_load(&j->cancelled))usleep(1000);}
static void complete(napi_env env,napi_status status,void*data){Job*j=data;j->complete=1;napi_value v;napi_create_int32(env,status==napi_cancelled?2:atomic_load(&j->started),&v);napi_resolve_deferred(env,j->done,v);napi_delete_async_work(env,j->work);napi_delete_reference(env,j->self);}
static void finalize(napi_env env,void*data,void*hint){(void)env;(void)hint;free(data);}
static napi_value started(napi_env env,napi_callback_info info){Job*j;napi_get_cb_info(env,info,NULL,NULL,NULL,(void**)&j);napi_value v;napi_get_boolean(env,atomic_load(&j->started),&v);return v;}
static napi_value cancel(napi_env env,napi_callback_info info){Job*j;napi_get_cb_info(env,info,NULL,NULL,NULL,(void**)&j);if(!j->complete){atomic_store(&j->cancelled,1);napi_cancel_async_work(env,j->work);}napi_value v;napi_get_undefined(env,&v);return v;}
static napi_value run(napi_env env,napi_callback_info info){(void)info;Job*j=calloc(1,sizeof(Job));napi_value name,promise,o,fn;napi_create_object(env,&o);napi_wrap(env,o,j,finalize,NULL,NULL);napi_create_reference(env,o,1,&j->self);napi_create_string_utf8(env,"active-probe",NAPI_AUTO_LENGTH,&name);napi_create_promise(env,&j->done,&promise);napi_set_named_property(env,o,"promise",promise);napi_create_function(env,"started",NAPI_AUTO_LENGTH,started,j,&fn);napi_set_named_property(env,o,"started",fn);napi_create_function(env,"cancel",NAPI_AUTO_LENGTH,cancel,j,&fn);napi_set_named_property(env,o,"cancel",fn);napi_create_async_work(env,NULL,name,execute,complete,j,&j->work);napi_queue_async_work(env,j->work);return o;}
NAPI_MODULE_INIT(){napi_value fn;napi_create_function(env,"run",NAPI_AUTO_LENGTH,run,NULL,&fn);napi_set_named_property(env,exports,"run",fn);return exports;}
