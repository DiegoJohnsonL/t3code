// Chromium drops fn/Globe (kVK_Function) flagsChanged events before web
// content or Electron's before-input-event can see them, so the main process
// watches for them here. A local monitor only sees events dispatched to this
// app's own windows and needs no Accessibility or Input Monitoring permission.

#import <AppKit/AppKit.h>
#import <Carbon/Carbon.h>
#include <node_api.h>

namespace {

id monitor = nil;
napi_threadsafe_function listener = nullptr;
bool bareFnHeld = false;

void report(const char *state) {
  napi_call_threadsafe_function(listener, const_cast<char *>(state), napi_tsfn_nonblocking);
}

NSEvent *handleEvent(NSEvent *event) {
  // Arrow, F-, and navigation keys also carry the Function flag, so only the
  // fn key itself counts as a press or release.
  if (event.type == NSEventTypeFlagsChanged && event.keyCode == kVK_Function) {
    bareFnHeld = (event.modifierFlags & NSEventModifierFlagFunction) != 0;
    report(bareFnHeld ? "down" : "up");
    // Consumed so macOS does not also run the Globe key action.
    return nil;
  }
  if (event.type == NSEventTypeKeyDown && bareFnHeld) {
    bareFnHeld = false;
    // No Function flag means fn was released while another app was active.
    if (event.modifierFlags & NSEventModifierFlagFunction) report("cancel");
  }
  return event;
}

void callListener(napi_env env, napi_value callback, void *, void *data) {
  // env is null when stop() discards events still queued for JavaScript.
  if (env == nullptr) return;
  napi_value state;
  napi_value receiver;
  napi_create_string_utf8(env, static_cast<const char *>(data), NAPI_AUTO_LENGTH, &state);
  napi_get_undefined(env, &receiver);
  napi_call_function(env, receiver, callback, 1, &state, nullptr);
}

void releaseMonitor(void *) {
  if (monitor != nil) [NSEvent removeMonitor:monitor];
  monitor = nil;
  if (listener != nullptr) napi_release_threadsafe_function(listener, napi_tsfn_abort);
  listener = nullptr;
  bareFnHeld = false;
}

void stopMonitor(napi_env env) {
  if (listener != nullptr) napi_remove_env_cleanup_hook(env, releaseMonitor, nullptr);
  releaseMonitor(nullptr);
}

napi_value stop(napi_env env, napi_callback_info) {
  stopMonitor(env);
  return nullptr;
}

napi_value start(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value callback = nullptr;
  napi_valuetype callbackType = napi_undefined;
  napi_get_cb_info(env, info, &argc, &callback, nullptr, nullptr);
  if (argc >= 1) napi_typeof(env, callback, &callbackType);
  if (callbackType != napi_function) {
    napi_throw_type_error(env, nullptr, "start expects a listener function");
    return nullptr;
  }
  stopMonitor(env);
  napi_value name;
  napi_create_string_utf8(env, "fnKey", NAPI_AUTO_LENGTH, &name);
  if (napi_create_threadsafe_function(env, callback, nullptr, name, 0, 1, nullptr, nullptr, nullptr,
                                      callListener, &listener) != napi_ok) {
    napi_throw_error(env, nullptr, "Could not create the fn key listener");
    return nullptr;
  }
  napi_unref_threadsafe_function(env, listener);
  // Registered after the listener, so environment teardown runs it first and
  // no key event can reach a released listener.
  napi_add_env_cleanup_hook(env, releaseMonitor, nullptr);
  monitor = [NSEvent addLocalMonitorForEventsMatchingMask:NSEventMaskFlagsChanged | NSEventMaskKeyDown
                                                  handler:^NSEvent *(NSEvent *event) {
                                                    return handleEvent(event);
                                                  }];
  return nullptr;
}

}  // namespace

NAPI_MODULE_INIT() {
  napi_property_descriptor methods[] = {
      {"start", nullptr, start, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"stop", nullptr, stop, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, sizeof(methods) / sizeof(methods[0]), methods);
  return exports;
}
