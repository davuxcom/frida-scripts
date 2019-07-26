(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict"; // The goal of this set of tests is to exercise the CLR helpers to create and interact with objects through the DotNetBridge.dll.

console.log("Begin");

const localSettings = require('./local_settings');

const CLR = require('../common/DotNet');

const System = CLR.GetNamespace("System");

const CLRDebug = require('../common/DotNet-debug');

CLRDebug.EnableTraceListener(); // Wait for the background thread to start.

System.Threading.Thread.Sleep(1000);
System.Diagnostics.Trace.WriteLine("hello");

function VERIFY_IS_EQUAL(expected, actual) {
  console.log("Verify: " + expected + " " + actual);

  if (actual != expected) {
    throw Error("----- FAILED -----\nVerify Failed\nExpected: " + expected + "\nActual: " + actual);
  }
}

const asmPath = localSettings.ScriptRoot + "TestLibrary1.dll";
console.log("Loading " + asmPath);
System.Reflection.Assembly.LoadFile(asmPath);
const TestLibrary1 = CLR.GetNamespace("TestLibrary1"); // Method

VERIFY_IS_EQUAL(TestLibrary1.Test1.TestMethod(), "TestMethod"); // Method<T>(T)

VERIFY_IS_EQUAL(TestLibrary1.Test1.TestGenericMethod.Of(System.IO.FileInfo)(new System.IO.FileInfo("f")), "System.IO.FileInfo"); // Method<T,V>(T, V)

VERIFY_IS_EQUAL(TestLibrary1.Test1.TestGenericMethod.Of(System.IO.FileInfo, System.Text.StringBuilder)(new System.IO.FileInfo("f"), new System.Text.StringBuilder()), "System.IO.FileInfo System.Text.StringBuilder"); // Generic+Boxed

VERIFY_IS_EQUAL(TestLibrary1.Test1.TestGenericMethod.Of(System.IO.FileInfo, System.Text.StringBuilder).Box(new System.IO.FileInfo("f"), new System.Text.StringBuilder()).ToString(), "System.IO.FileInfo System.Text.StringBuilder"); // Static and instance fields

VERIFY_IS_EQUAL(TestLibrary1.Test1.Static5, 5);
TestLibrary1.Test1.Static5 = 7;
VERIFY_IS_EQUAL(TestLibrary1.Test1.Static5, 7);
var test1 = new TestLibrary1.Test1();
VERIFY_IS_EQUAL(test1.Instance5, 5);
test1.Instance5 = 4;
VERIFY_IS_EQUAL(test1.Instance5, 4); // nested classes

var nested = new TestLibrary1.Test1.NestedClass();
VERIFY_IS_EQUAL(nested.Instance5, "5");
var twiceNested = new TestLibrary1.Test1.NestedClass.TwiceNestedClass();
VERIFY_IS_EQUAL(twiceNested.Instance7, "7"); // Boxing

VERIFY_IS_EQUAL(new System.Byte.Parse.Box("10").ToString(), "10"); // Test indexer

var dict = new System.Collections.Generic.Dictionary.Of(System.String, System.String)();
dict.Add("One", "OneValue");
VERIFY_IS_EQUAL(dict.get_Item("One"), "OneValue");
dict.set_Item("Two", "NewTwo");
VERIFY_IS_EQUAL(dict.get_Item("Two"), "NewTwo"); // further dictionary sanity check

VERIFY_IS_EQUAL(dict.Keys.Count, 2);
var dict_enum = dict.Values.GetEnumerator();
dict_enum.MoveNext();
dict_enum.MoveNext();
dict_enum.MoveNext();
VERIFY_IS_EQUAL(dict_enum.Current, null); // Test property

var p = new System.Diagnostics.ProcessStartInfo();
p.Arguments = "testargs";
VERIFY_IS_EQUAL(p.Arguments, "testargs"); // Delegates
// Action

var didAct = false;
var act = new System.Action(function () {
  didAct = true;
});
VERIFY_IS_EQUAL(act.Invoke() ? didAct : didAct, true);
didAct = false;
var act = new System.Action.Of(System.Boolean)(function (b) {
  didAct = true;
});
VERIFY_IS_EQUAL(act.Invoke(true) ? didAct : didAct, true); // Func<String,bool>

var fn = new System.Func.Of(System.String, System.Boolean)(function (str) {
  return true;
});
VERIFY_IS_EQUAL(fn.Invoke("foo"), true); // Func<bool,String>

var fn2 = new System.Func.Of(System.Boolean, System.String)(function (str) {
  return "foo";
});
VERIFY_IS_EQUAL(fn2.Invoke(true), "foo"); // Func<String, FileInfo>

var fn3 = new System.Func.Of(System.String, System.IO.FileInfo)(function (str) {
  return new System.IO.FileInfo(str);
});
VERIFY_IS_EQUAL(fn3.Invoke("file_test.txt").Name, "file_test.txt"); // Func<FileInfo, String>

var fn4 = new System.Func.Of(System.IO.FileInfo, System.String)(function (fi) {
  return fi.Name;
});
VERIFY_IS_EQUAL(fn4.Invoke(System.IO.FileInfo("file_test2.txt")), "file_test2.txt"); // Events
// Register

var asmLoaded = false;
var eventToken = System.AppDomain.CurrentDomain.AssemblyLoad += new System.AssemblyLoadEventHandler(function (s, e) {
  asmLoaded = true;
});
System.Reflection.Assembly.LoadWithPartialName("PresentationFramework");
VERIFY_IS_EQUAL(asmLoaded, true); // Unregister

System.AppDomain.CurrentDomain.AssemblyLoad.remove(eventToken);
asmLoaded = false;
System.Reflection.Assembly.LoadWithPartialName("System.Windows.Forms");
VERIFY_IS_EQUAL(asmLoaded, false); // will have generated loads
// Scenario test: thread

var apt = null;
var uiThread = new System.Threading.Thread(new System.Threading.ThreadStart(function () {
  apt = System.Threading.Thread.CurrentThread.ApartmentState;
  System.Threading.Thread.Sleep(500);
}));
uiThread.SetApartmentState(System.Threading.ApartmentState.STA);
uiThread.Start();
uiThread.Join();
VERIFY_IS_EQUAL(apt, "STA");
VERIFY_IS_EQUAL(System.Threading.ApartmentState.STA, "STA"); // Verify that System.Byte is auto-casted to an object instance (i.e. implicit typeof())

var arr = System.Array.CreateInstance(System.Byte, 10); // Verify that a boxed value can be used for byte, since otherwise we fail to downcast from int.

arr.SetValue(System.Byte.Parse.Box("10"), 0);
var Registry = CLR.GetNamespace("Microsoft").Win32.Registry; // Field

var sn = Registry.CurrentUser.OpenSubKey("Software").GetSubKeyNames(); // Ref param

var i = System.Int32.Parse.Box("5");
TestLibrary1.Test1.TestRef(i);
VERIFY_IS_EQUAL(i.ToString(), 10); // out param

var io = System.Int32.Parse.Box("5");
TestLibrary1.Test1.TestOut(io);
VERIFY_IS_EQUAL(io.ToString(), 10); // verify pinning

var io = System.Int32.Parse.Box("5");
CLR.Pin(io);
console.log("GC: " + CLR.Prune());
var objectNotFound = false;

try {
  i.ToString();
} catch (e) {
  objectNotFound = true;
}

io.ToString();
VERIFY_IS_EQUAL(objectNotFound, true);
console.log("####################################");
console.log("####################################");
console.log("             SUCCESS");
console.log("####################################");
console.log("####################################");
console.log("[*] Unloading...");
System.Threading.Thread.Sleep(1000);
System.Diagnostics.Process.GetCurrentProcess().Kill();

},{"../common/DotNet":4,"../common/DotNet-debug":3,"./local_settings":2}],2:[function(require,module,exports){
module.exports={ScriptRoot: "C:/git/frida-scripts/Test-DotNetBridge/"} 

},{}],3:[function(require,module,exports){
"use strict"; // Simple solution to getting output from System.Diagnostics.Trace.WriteLine.

const CLR = require('./dotnet');

const System = CLR.GetNamespace("System");
module.exports = {
  EnableTraceListener: function () {
    var tracingThread = new System.Threading.Thread(new System.Threading.ThreadStart(function () {
      var traceBuffer = System.Array.CreateInstance(System.Byte.$Clr_TypeOf(), 1024 * 1024 * 1024); // TODO: can't threadsafe reset tho

      CLR.Pin(traceBuffer);
      var write_ms = new System.IO.MemoryStream(traceBuffer, true);
      CLR.Pin(write_ms);
      System.Diagnostics.Trace.Listeners.Add(new System.Diagnostics.TextWriterTraceListener(write_ms)); // ThreadProc

      var last_write = 0;

      while (true) {
        System.Diagnostics.Trace.Flush();
        var newLength = write_ms.Position;

        if (last_write != newLength) {
          var line = System.Text.Encoding.UTF8.GetString(traceBuffer, last_write, newLength - last_write);
          last_write = newLength;
          var spl = line.split("\n");

          for (var lx in spl) {
            if (spl[lx]) {
              console.log("DotNet: " + spl[lx].trim());
            }
          }
        }

        System.Threading.Thread.Sleep(500);
      }
    }));
    tracingThread.Start();
  }
};

},{"./dotnet":6}],4:[function(require,module,exports){
(function (global){
"use strict"; // GOAL: Using the below DotNetBridge, build JS objects to represent a root namespace and all subsequent types.
//
// Known limitations: We can't create a new type unless we have an assembly to load (which can be done)

const Win32 = require('./win32');

const Struct = require('./struct');

const GUID = require('./guid');

const COM = require('./com'); // InProc component that is expected to be found in the registry.


var CLSID_DotNetBridge = GUID.alloc("ddb71722-f7e5-4c45-817e-cc1b84bfab4e");
var IDotNetBridge = new COM.Interface(COM.IUnknown, {
  CreateObject: [0, ['pointer', 'pointer', 'pointer']],
  DescribeObject: [1, ['pointer', 'pointer', 'pointer']],
  CreateDelegate: [2, ['pointer', 'pointer', 'pointer']],
  InvokeMethod: [3, ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'int', 'pointer']],
  ReleaseObject: [4, ['pointer', 'pointer']],
  DescribeNamespace: [5, ['pointer', 'pointer']]
}, "ea688a1d-4be4-4cae-b2a3-9a389fcd1c8b");

function ResolveResult(result) {
  var ret = JSON.parse(Memory.readUtf16String(result));

  if (ret && ret.__ERROR) {
    throw Error(ret.Message + "\n" + ret.Stack + "\n");
  } else if (ret && ret.__OBJECT) {
    ret = new ClrObjectWrapper(ret);
  }

  return ret;
}

function ResolveArgs(params) {
  if (typeof params === 'undefined') {
    params = [];
  }

  if (Object.prototype.toString.call(params) === '[object Array]') {
    for (var i = 0; i < params.length; ++i) {
      if (params[i] && params[i].$Clr_IsClrObject) {
        params[i] = params[i].$Clr_Handle;
      }

      if (params[i] && params[i].$Clr_IsClrType) {
        params[i] = params[i].$Clr_TypeOf().$Clr_Handle;
      }
    }

    return JSON.stringify(params);
  } else {
    throw new Error("Bad args " + params);
  }
}

function DotNetBridge() {
  console.log("[*] Creating DotNetBridge");
  var bridge = COM.CreateInstance(CLSID_DotNetBridge, COM.ClassContext.InProc, IDotNetBridge);

  function DoCall(method) {
    var args = [];

    for (var i = 1; i < arguments.length; ++i) {
      args[i - 1] = arguments[i];
    }

    var outPtr = new Struct({
      'value': 'pointer'
    });
    args[args.length] = outPtr.Get();
    COM.ThrowIfFailed(bridge[method].apply(bridge[method], args));
    return outPtr.value;
  }

  this.CreateObject = function (typeInfo, args) {
    if (typeInfo.IsDelegate) {
      return ResolveResult(DoCall("CreateDelegate", Memory.allocUtf16String(typeInfo.TypeName), JsonDelegate(args)));
    } else {
      return ResolveResult(DoCall("CreateObject", Memory.allocUtf16String(typeInfo.TypeName), Memory.allocUtf16String(ResolveArgs(args))));
    }
  };

  this.DescribeObject = function (typeName, objHandle) {
    if (typeof typeName === "string") {
      typeName = Memory.allocUtf16String(typeName);
      objHandle = NULL;
    } else {
      objHandle = Memory.allocUtf16String(JSON.stringify(objHandle));
      typeName = NULL;
    }

    return ResolveResult(DoCall("DescribeObject", typeName, objHandle));
  };

  this.ReleaseObject = function (objHandle) {
    return ResolveResult(DoCall("ReleaseObject", Memory.allocUtf16String(JSON.stringify(objHandle))));
  };

  this.DescribeNamespace = function (namespaceName) {
    return ResolveResult(DoCall("DescribeNamespace", Memory.allocUtf16String(namespaceName)));
  };

  this.InvokeMethod = function (objHandle, typeInfo, method, args, genericTypes, returnBoxed) {
    return ResolveResult(DoCall("InvokeMethod", objHandle == null ? NULL : Memory.allocUtf16String(JSON.stringify(objHandle)), Memory.allocUtf16String(typeInfo.TypeName), Memory.allocUtf16String(method), Memory.allocUtf16String(ResolveArgs(args)), genericTypes ? Memory.allocUtf16String(JSON.stringify(genericTypes.$Clr_Handle)) : NULL, returnBoxed ? 1 : 0));
  };
} // Ensure the bridge is a singleton, even if this script is included multiple times.


function GetBridgeInstance() {
  const CLR_BRIDGE_TAG = "$$CLRBRIDGE";
  global[CLR_BRIDGE_TAG] = CLR_BRIDGE_TAG in global ? global[CLR_BRIDGE_TAG] : new DotNetBridge();
  return global[CLR_BRIDGE_TAG];
}

const BridgeExports = GetBridgeInstance();
var all_Objects = [];
var callback_objects = [];
var saved_Objects = [];

function ExposeMethodsFromType(self, typeInfo) {
  function CreateMethod(self, method) {
    var invokeMethod = function () {
      return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0));
    };

    invokeMethod.Of = function () {
      var genericTypes = CreateClrTypeWrapper("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);

      for (var i = 0; i < arguments.length; ++i) {
        genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i);
      }

      var invokeGenericMethod = function () {
        return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes);
      };

      invokeGenericMethod.Box = function () {
        return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes, true);
      };

      return invokeGenericMethod;
    };

    invokeMethod.Box = function () {
      return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), null, true);
    }; // Wire get_ and set_ to a property get/set.


    if (method.Name.startsWith("get_") && method.Parameters.length == 0 || method.Name.startsWith("set_") && method.Parameters.length == 1) {
      try {
        var shortMethodName = method.Name.slice("get_".length);
        Object.defineProperty(self, shortMethodName, {
          get: function () {
            return self.$Clr_Invoke("get_" + shortMethodName, []);
          },
          set: function (newValue) {
            return self.$Clr_Invoke("set_" + shortMethodName, [newValue]);
          }
        });
      } catch (e) {// console.warn("Can't define " + shortMethodName);
        // BUG: 'MaxWorkingSet may not be redefined.'
        // We can't overwrite reserved keywords.
      }
    } else if (method.Name.startsWith("add_") && method.Parameters && method.Parameters.length == 1 || method.Name.startsWith("remove_") && method.Parameters && method.Parameters.length == 1) {
      var shortMethodName = method.Name.substring(method.Name.startsWith("add_") ? "add_".length : "remove_".length);

      if (self[shortMethodName]) {
        return;
      }

      Object.defineProperty(self, shortMethodName, {
        get: function () {
          var EventHandler = new function () {
            this.add = function (delegate) {
              self.$Clr_Invoke("add_" + shortMethodName, [delegate]);
              return delegate;
            };

            this.remove = function (delegate) {
              // token = obj += delegate ... token is delegate.toString which is JSON by convention.
              if (typeof delegate == "string") {
                delegate = new ClrObjectWrapper(JSON.parse(delegate));
              }

              return self.$Clr_Invoke("remove_" + shortMethodName, [delegate]);
            }; // This makes it "" + other.toString() in the setter below when doing "handler += other"


            this.toString = function () {
              return "";
            };
          }();
          return EventHandler;
        },
        set: function (objHandle_string) {
          self.$Clr_Invoke("add_" + shortMethodName, [new ClrObjectWrapper(JSON.parse(objHandle_string))]);
        }
      });
    } else {
      self[method.Name] = invokeMethod;
    }
  }

  ;

  if (typeInfo.Methods) {
    for (var i = 0; i < typeInfo.Methods.length; ++i) {
      CreateMethod(self, typeInfo.Methods[i]);
    }
  }

  function ExposeField(self, name) {
    Object.defineProperty(self, name, {
      get: function () {
        return self.$Clr_Invoke(name, []);
      },
      set: function (value) {
        return self.$Clr_Invoke(name, [value]);
      }
    });
  }

  if (typeInfo.Fields) {
    for (var i = 0; i < typeInfo.Fields.length; ++i) {
      ExposeField(self, typeInfo.Fields[i]);
    }
  }
}

function ExposeNestedTypesFromType(self, typeInfo) {
  function CreateValue(self, name) {
    try {
      var shortName = name.replace(typeInfo.TypeName + "+", "");
      Object.defineProperty(self, shortName, {
        get: function () {
          return CreateClrTypeWrapper(name);
        }
      });
    } catch (e) {
      console.warn("Can't define " + name);
    }
  }

  ;

  if (typeInfo.NestedTypes) {
    for (var i = 0; i < typeInfo.NestedTypes.length; ++i) {
      CreateValue(self, typeInfo.NestedTypes[i]);
    }
  }
}

function CreateClrTypeWrapperFromInfo(typeInfo) {
  var ConstructorFunction = function () {
    // don't .slice (destroy) the callback argument.
    return BridgeExports.CreateObject(typeInfo, typeInfo.IsDelegate ? arguments[0] : Array.prototype.slice.call(arguments));
  };

  ConstructorFunction.$Clr_IsClrType = true;

  ConstructorFunction.$Clr_TypeOf = function () {
    return GetTypeByName(typeInfo.TypeName);
  };

  ConstructorFunction.$Clr_TypeInfo = typeInfo;

  ConstructorFunction.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
    return BridgeExports.InvokeMethod(null, typeInfo, method, args, genericTypes, returnBoxed);
  };

  ConstructorFunction.toString = function () {
    return "[ClrType " + typeInfo.TypeName + "]";
  }; // Could be overwritten.


  ConstructorFunction.Of = function () {
    var genericTypes = CreateClrTypeWrapper("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);

    for (var i = 0; i < arguments.length; ++i) {
      genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i);
    }

    var genericType = CreateClrTypeWrapper(typeInfo.TypeName + "`" + arguments.length).$Clr_TypeOf().MakeGenericType(genericTypes);
    return CreateClrTypeWrapper(genericType.FullName);
  };

  ExposeMethodsFromType(ConstructorFunction, typeInfo); // Static

  ExposeNestedTypesFromType(ConstructorFunction, typeInfo); // Nested types

  return ConstructorFunction;
}

function CreateClrTypeWrapper(typeName, objHandle) {
  return CreateClrTypeWrapperFromInfo(BridgeExports.DescribeObject(typeName, objHandle));
}

function ClrObjectWrapper(objHandle) {
  var typeInfo = BridgeExports.DescribeObject(NULL, objHandle);
  this.$Clr_IsClrObject = true;
  this.$Clr_TypeInfo = typeInfo;
  this.$Clr_Handle = objHandle;

  this.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
    return BridgeExports.InvokeMethod(objHandle, typeInfo, method, args, genericTypes, returnBoxed);
  };

  if (typeInfo.IsEnum) {
    this.value = typeInfo.EnumValue;

    this.toString = function () {
      return this.ToString();
    };
  } else if (typeInfo.IsDelegate) {
    // Used in event add_/remove_ for "+=" semantics.
    this.toString = function () {
      return JSON.stringify(objHandle);
    };
  } else {
    this.toString = function () {
      return "[ClrObject " + typeInfo.TypeName + ": " + this.ToString() + "]";
    };
  }

  ExposeMethodsFromType(this, typeInfo);
  all_Objects.push(this);
}

function GetTypeByName(typeName) {
  var type = CreateClrTypeWrapper("System.Type").GetType(typeName);
  if (type != null) return type;
  var asm = CreateClrTypeWrapper("System").AppDomain.CurrentDomain.GetAssemblies();
  var asmLength = asm.Length;

  for (var i = 0; i < asmLength; i++) {
    type = asm.GetValue(i).GetType(typeName);

    if (type != null) {
      return type;
    }
  }

  return null;
}

function JsonDelegate(func) {
  var callback = new NativeCallback(function (argsPtr) {
    // Unpack json args and resolve object references.
    var args = JSON.parse(Memory.readUtf16String(argsPtr));

    for (var i = 0; i < args.length; ++i) {
      if (args[i].__OBJECT) {
        args[i] = new ClrObjectWrapper(args[i]);
      }
    }

    var ret = func.apply(func, args); // Pack up the result into object references

    if (Object.prototype.toString.call(ret) === '[object Array]') {
      for (var i = 0; i < ret.length; ++i) {
        if (ret[i].$Clr_IsClrObject) {
          ret[i] = ret[i].$Clr_Handle;
        }
      }
    }

    if (ret) {
      if (ret.$Clr_IsClrObject) {
        ret = ret.$Clr_Handle;
      }

      return Memory.allocUtf16String(JSON.stringify(ret));
      ;
    }

    return NULL;
  }, 'pointer', ['pointer'], Win32.Abi); // If we don't do this, the GC is so quick it'll never be able to call back and AV.

  callback_objects.push(callback);
  return callback;
}

function GetNamespace(namespaceName) {
  return new function () {
    var namespaceInfo = BridgeExports.DescribeNamespace(namespaceName);
    this.$Clr_TypeInfo = namespaceInfo;

    function CreateProperty(self, leafName, isType, callback) {
      try {
        var is_mangled = false;
        var resolved_leaf_name = leafName;

        if (leafName.indexOf("`") > -1) {
          is_mangled = true;
          resolved_leaf_name = leafName.substring(0, leafName.indexOf("`"));
        }

        Object.defineProperty(self, resolved_leaf_name, {
          get: function () {
            return callback(resolved_leaf_name, isType, is_mangled);
          }
        });
      } catch (e) {// console.warn("couldn't define " + leafName + " on " + namespaceName + ":\n" + e);
      }
    }

    for (var i = 0; i < namespaceInfo.length; ++i) {
      CreateProperty(this, namespaceInfo[i].Name, namespaceInfo[i].IsType, function (leafName, isType, isMangled) {
        var fullLeafName = namespaceName + "." + leafName;

        if (isType) {
          if (isMangled) {
            // The problem is that we are given Func`1 and we can't be sure that Func will exist.
            // If it does, we need to use that, but if it doesn't, we need to hand back something that 
            // .Of(T) may be called on so that the generic types may still be accessed in either case.
            try {
              return CreateClrTypeWrapper(fullLeafName);
            } catch (e) {
              return CreateClrTypeWrapperFromInfo({
                TypeName: fullLeafName
              });
            }
          }

          return CreateClrTypeWrapper(fullLeafName);
        } else {
          return GetNamespace(fullLeafName);
        }
      });
    }
  }();
}

module.exports = {
  GetNamespace: GetNamespace,
  // Basic memory management, note callbacks are still leaked.
  Prune: function () {
    var outstanding = all_Objects.length;

    for (var i = outstanding - 1; i > -1; --i) {
      BridgeExports.ReleaseObject(all_Objects[i].$Clr_Handle);
    }

    all_Objects.length = 0;
    return outstanding;
  },
  Pin: function (obj) {
    all_Objects.splice(all_Objects.indexOf(obj), 1);
    saved_Objects.push(obj);
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./com":5,"./guid":7,"./struct":8,"./win32":9}],5:[function(require,module,exports){
const Struct = require('./struct');

const GUID = require('./guid');

const Win32 = require('./win32');

var HRESULTMap = [['E_ABORT', 0x80004004], ['E_ACCESSDENIED', 0x80070005], ['E_FAIL', 0x80004005], ['E_HANDLE', 0x80070006], ['E_INVALIDARG', 0x80070057], ['E_NOINTERFACE', 0x80004002], ['E_NOTIMPL', 0x80004001], ['E_OUTOFMEMORY', 0x8007000E], ['E_POINTER', 0x80004003], ['E_UNEXPECTED', 0x8000FFFF]]; // COM global constants

var S_OK = 0;
var S_FALSE = 1;
var E_NOINTERFACE = 0x80004002; // COM Flow control

function Succeeded(hr) {
  var ret = parseInt(hr, 10);
  return ret == S_OK || ret == S_FALSE;
}

function Failed(hr) {
  return !Succeeded(hr);
}

function ThrowIfFailed(hr) {
  if (Failed(hr)) {
    var friendlyStr = "";

    for (var i = 0; i < HRESULTMap.length; ++i) {
      if (hr == HRESULTMap[i][1]) {
        friendlyStr = " " + HRESULTMap[i][0];
        break;
      }
    }

    throw new Error('COMException 0x' + hr.toString(16) + friendlyStr);
  }

  return hr;
}

var IUnknown = {
  IID: GUID.alloc("00000000-0000-0000-C000-000000000046"),
  QueryInterface: [0, ['pointer', 'pointer']],
  AddRef: [1, []],
  Release: [2, []]
};
var IInspectable = {
  IID: GUID.alloc("AF86E2E0-B12D-4c6a-9C5A-D7AA65101E90"),
  // IUnknown
  QueryInterface: IUnknown.QueryInterface,
  AddRef: IUnknown.AddRef,
  Release: IUnknown.Release,
  // IInspectable
  GetIids: [3, ['pointer', 'pointer']],
  GetRuntimeClassName: [4, ['pointer']],
  GetTrustLevel: [5, ['pointer']]
};
var IAgileObject = new ComInterface(IUnknown, {// Marker interface, it has no methods.
}, "94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90");
var Ole32 = {
  CoInitializeEx: new NativeFunction(Module.findExportByName("Ole32.dll", "CoInitializeEx"), 'uint', ['pointer', 'uint'], Win32.Abi),
  CoCreateInstance: new NativeFunction(Module.findExportByName("Ole32.dll", "CoCreateInstance"), 'uint', ['pointer', 'pointer', 'uint', 'pointer', 'pointer'], Win32.Abi)
};

function ComInterface(baseInterface, methods, iid_str) {
  for (var method in methods) {
    this[method] = methods[method];
  }

  this.IID = GUID.alloc(iid_str);

  if (baseInterface.IID == IInspectable.IID) {
    this.IInspectable = true;
  }
}

function iunknown_ptr(address, idl) {
  function vtable_wrapper(address) {
    var getMethodAddress = function (ordinal) {
      var addr = Memory.readPointer(address); // vtbl

      return Memory.readPointer(addr.add(Process.pointerSize * ordinal)); // pointer to func
    };

    this.GetMethodAddress = getMethodAddress;

    this.Invoke = function (ordinal, paramTypes, params, tagName) {
      if (address == 0x0) {
        throw Error("Can't invoke method on null pointer");
      } //console.log("com_ptr(" + address + ")->" + tagName + " (" + params + ")");
      // Add 'this' as first argument


      var localTypes = paramTypes.slice();
      localTypes.unshift('pointer');
      var localParams = params.slice();
      localParams.unshift(address);
      var fn = new NativeFunction(getMethodAddress(ordinal), 'uint', localTypes, Win32.Abi);
      return fn.apply(fn, localParams);
    };
  }

  var vtable = new vtable_wrapper(address);

  var calculateOrdinal = function (ordinal) {
    var countMethods = function (idl) {
      var count = -1; // IID will be the only non-method property.

      for (var method in idl) {
        ++count;
      }

      return count;
    };

    return ordinal + (idl.IInspectable ? countMethods(IInspectable) : countMethods(IUnknown));
  };

  this.InvokeMethod = function (ordinal, paramTypes, params, tagName) {
    return vtable.Invoke(calculateOrdinal(ordinal), paramTypes, params, tagName);
  };

  this.GetMethodAddress = function (ordinal) {
    return vtable.GetMethodAddress(calculateOrdinal(ordinal));
  }; // IUnknown


  this.QueryInterface = function (iid, ppv) {
    return vtable.Invoke(IUnknown.QueryInterface[0], IUnknown.QueryInterface[1], [iid, ppv], "QueryInterface");
  };

  this.AddRef = function () {
    return vtable.Invoke(IUnknown.AddRef[0], IUnknown.AddRef[1], [], "AddRef");
  };

  this.Release = function () {
    return vtable.Invoke(IUnknown.Release[0], IUnknown.Release[1], [], "Release");
  }; // IInspectable


  this.GetIids = function () {
    var size_ptr = new Struct({
      'value': 'pointer'
    });
    var iids_ptr = new Struct({
      'value': 'pointer'
    });
    ThrowIfFailed(vtable.Invoke(IInspectable.GetIids[0], IInspectable.GetIids[1], [size_ptr.Get(), iids_ptr.Get()], "GetIids"));
    var size = Memory.readUInt(size_ptr.value);
    var ret = [];

    for (var i = 0; i < size; ++i) {
      ret.push(GUID.read(iids_ptr.value.add(i * Process.pointerSize)));
    }

    return ret;
  };

  this.GetRuntimeClassName = function () {
    var class_name_ptr = new Struct({
      'value': 'pointer'
    });

    if (Succeeded(vtable.Invoke(IInspectable.GetRuntimeClassName[0], IInspectable.GetRuntimeClassName[1], [class_name_ptr.Get()], "GetRuntimeClassName"))) {
      return WinRT.HSTRING.read(class_name_ptr.value);
    } else {
      return "[GetRuntimeClassName Failed]";
    }
  };

  this.GetTrustLevel = function () {
    var trust_ptr = new Struct({
      'value': 'pointer'
    });
    ThrowIfFailed(vtable.Invoke(IInspectable.GetTrustLevel[0], IInspectable.GetTrustLevel[1], [trust_ptr.Get()], "GetTrustLevel"));
    var trust_level = Memory.readUInt(trust_ptr.value);
    return trust_level == 0 ? "BaseTrust" : trust_level == 1 ? "PartialTrust" : "FullTrust";
  };
}

function com_ptr(idl) {
  var _ptr = new Struct({
    'value': 'pointer'
  }); // the real reference is here


  var resolve_ptr = function () {
    return new iunknown_ptr(_ptr.value, idl);
  };

  this.$ComPtr_Invoke = function (methodDfn, args) {
    return resolve_ptr().InvokeMethod(methodDfn[0], methodDfn[1], args, "$ComPtr_Invoke");
  };

  this.$ComPtr_GetMethodAddress = function (methodDfn) {
    return resolve_ptr().GetMethodAddress(methodDfn[0]);
  };

  this.Release = function () {
    return resolve_ptr().Release();
  };

  this.GetAddressOf = function () {
    return _ptr.Get();
  };

  this.Get = function () {
    return _ptr.value;
  };

  this.As = function (otherIdl) {
    var ret = new com_ptr(otherIdl);
    ThrowIfFailed(resolve_ptr().QueryInterface(otherIdl.IID, ret.GetAddressOf()));
    return ret;
  };

  this.Attach = function (addr) {
    _ptr.value = addr;
    return this;
  };

  this.toString = function () {
    var iinspectable_extra = idl == IInspectable && _ptr.value != 0x0 ? " " + resolve_ptr().GetRuntimeClassName() + " IInspectable" + resolve_ptr().GetIids() + " " + resolve_ptr().GetTrustLevel() : "";
    return "[com_ptr " + _ptr.Get() + iinspectable_extra + "]";
  };

  var self = this;

  var CreateMethod = function (methodName) {
    var removed_methods = ["QueryInterface", "AddRef", "Release", "GetIids", "GetRuntimeClassName", "GetTrustLevel", "IID", "IInspectable"];

    for (var i = 0; i < removed_methods.length; ++i) {
      if (removed_methods[i] == method) {
        return;
      }
    }

    var MethodProc = function () {
      return resolve_ptr().InvokeMethod(idl[methodName][0], idl[methodName][1], Array.prototype.slice.call(arguments, 0), methodName, idl[methodName][2]);
    };

    MethodProc.GetAddressOf = function () {
      return resolve_ptr().GetMethodAddress(idl[methodName][0]);
    };

    self[methodName] = MethodProc;
  }; // Add IDL methods onto this object.


  for (var method in idl) {
    CreateMethod(method);
  }
}

function RuntimeComObject(iid) {
  var vtable_entries = [];
  var iids = [IUnknown.IID, IAgileObject.IID, iid];
  var refCount = 1;

  this.AddEntry = function (callback, retType, paramTypes) {
    vtable_entries.push(new NativeCallback(callback, retType, paramTypes, Win32.Abi));
  };

  this.AddIid = function (iid) {
    iids.push(iid);
  };

  this.GetAddress = function () {
    var vTable = Memory.alloc(Process.pointerSize * vtable_entries.length);

    for (var i = 0; i < vtable_entries.length; ++i) {
      var vTableEntry = vTable.add(Process.pointerSize * i);
      Memory.writePointer(vTableEntry, vtable_entries[i]);
    }

    var com_object_pointer = new Struct({
      'value': 'pointer'
    });
    com_object_pointer.value = vTable;
    return com_object_pointer.Get();
  }; // QueryInterface


  this.AddEntry(function (this_ptr, riid, ppv) {
    var find_guid = GUID.read(riid);

    for (var i = 0; i < iids.length; ++i) {
      if (GUID.read(iids[i]) == find_guid) {
        ++refCount;
        Memory.writePointer(ppv, this_ptr); //console.log("RuntimeComObject QueryInterface S_OK: " + find_guid);

        return S_OK;
      }
    }

    console.error("RuntimeComObject QueryInterface E_NOINTERFACE: " + find_guid);
    return E_NOINTERFACE;
  }, 'uint', ['pointer', 'pointer', 'pointer']); // AddRef

  this.AddEntry(function (this_ptr) {
    return ++refCount;
  }, 'ulong', ['pointer']); // Release

  this.AddEntry(function (this_ptr) {
    return --refCount;
  }, 'ulong', ['pointer']);
}

module.exports = {
  S_OK: S_OK,
  ApartmentType: {
    // COINIT
    STA: 0x2,
    MTA: 0x0
  },
  ClassContext: {
    // CLSCTX
    InProc: 0x1,
    Local: 0x4
  },
  IUnknown: IUnknown,
  IInspectable: IInspectable,
  Pointer: com_ptr,
  Interface: ComInterface,
  RuntimeObject: RuntimeComObject,
  Succeeded: Succeeded,
  Failed: Failed,
  ThrowIfFailed: ThrowIfFailed,
  CreateInstance: function (clsid, clsctx, idl) {
    var ret = new com_ptr(idl);
    ThrowIfFailed(Ole32.CoCreateInstance(clsid, NULL, clsctx, idl.IID, ret.GetAddressOf()));
    return ret;
  },
  Initialize: function (apartment) {
    ThrowIfFailed(Ole32.CoInitializeEx(NULL, apartment));
  }
};

},{"./guid":7,"./struct":8,"./win32":9}],6:[function(require,module,exports){
(function (global){
"use strict"; // GOAL: Using the below DotNetBridge, build JS objects to represent a root namespace and all subsequent types.
//
// Known limitations: We can't create a new type unless we have an assembly to load (which can be done)

const Win32 = require('./win32');

const Struct = require('./struct');

const GUID = require('./guid');

const COM = require('./com'); // InProc component that is expected to be found in the registry.


var CLSID_DotNetBridge = GUID.alloc("ddb71722-f7e5-4c45-817e-cc1b84bfab4e");
var IDotNetBridge = new COM.Interface(COM.IUnknown, {
  CreateObject: [0, ['pointer', 'pointer', 'pointer']],
  DescribeObject: [1, ['pointer', 'pointer', 'pointer']],
  CreateDelegate: [2, ['pointer', 'pointer', 'pointer']],
  InvokeMethod: [3, ['pointer', 'pointer', 'pointer', 'pointer', 'pointer', 'int', 'pointer']],
  ReleaseObject: [4, ['pointer', 'pointer']],
  DescribeNamespace: [5, ['pointer', 'pointer']]
}, "ea688a1d-4be4-4cae-b2a3-9a389fcd1c8b");

function ResolveResult(result) {
  var ret = JSON.parse(Memory.readUtf16String(result));

  if (ret && ret.__ERROR) {
    throw Error(ret.Message + "\n" + ret.Stack + "\n");
  } else if (ret && ret.__OBJECT) {
    ret = new ClrObjectWrapper(ret);
  }

  return ret;
}

function ResolveArgs(params) {
  if (typeof params === 'undefined') {
    params = [];
  }

  if (Object.prototype.toString.call(params) === '[object Array]') {
    for (var i = 0; i < params.length; ++i) {
      if (params[i] && params[i].$Clr_IsClrObject) {
        params[i] = params[i].$Clr_Handle;
      }

      if (params[i] && params[i].$Clr_IsClrType) {
        params[i] = params[i].$Clr_TypeOf().$Clr_Handle;
      }
    }

    return JSON.stringify(params);
  } else {
    throw new Error("Bad args " + params);
  }
}

function DotNetBridge() {
  console.log("[*] Creating DotNetBridge");
  var bridge = COM.CreateInstance(CLSID_DotNetBridge, COM.ClassContext.InProc, IDotNetBridge);

  function DoCall(method) {
    var args = [];

    for (var i = 1; i < arguments.length; ++i) {
      args[i - 1] = arguments[i];
    }

    var outPtr = new Struct({
      'value': 'pointer'
    });
    args[args.length] = outPtr.Get();
    COM.ThrowIfFailed(bridge[method].apply(bridge[method], args));
    return outPtr.value;
  }

  this.CreateObject = function (typeInfo, args) {
    if (typeInfo.IsDelegate) {
      return ResolveResult(DoCall("CreateDelegate", Memory.allocUtf16String(typeInfo.TypeName), JsonDelegate(args)));
    } else {
      return ResolveResult(DoCall("CreateObject", Memory.allocUtf16String(typeInfo.TypeName), Memory.allocUtf16String(ResolveArgs(args))));
    }
  };

  this.DescribeObject = function (typeName, objHandle) {
    if (typeof typeName === "string") {
      typeName = Memory.allocUtf16String(typeName);
      objHandle = NULL;
    } else {
      objHandle = Memory.allocUtf16String(JSON.stringify(objHandle));
      typeName = NULL;
    }

    return ResolveResult(DoCall("DescribeObject", typeName, objHandle));
  };

  this.ReleaseObject = function (objHandle) {
    return ResolveResult(DoCall("ReleaseObject", Memory.allocUtf16String(JSON.stringify(objHandle))));
  };

  this.DescribeNamespace = function (namespaceName) {
    return ResolveResult(DoCall("DescribeNamespace", Memory.allocUtf16String(namespaceName)));
  };

  this.InvokeMethod = function (objHandle, typeInfo, method, args, genericTypes, returnBoxed) {
    return ResolveResult(DoCall("InvokeMethod", objHandle == null ? NULL : Memory.allocUtf16String(JSON.stringify(objHandle)), Memory.allocUtf16String(typeInfo.TypeName), Memory.allocUtf16String(method), Memory.allocUtf16String(ResolveArgs(args)), genericTypes ? Memory.allocUtf16String(JSON.stringify(genericTypes.$Clr_Handle)) : NULL, returnBoxed ? 1 : 0));
  };
} // Ensure the bridge is a singleton, even if this script is included multiple times.


function GetBridgeInstance() {
  const CLR_BRIDGE_TAG = "$$CLRBRIDGE";
  global[CLR_BRIDGE_TAG] = CLR_BRIDGE_TAG in global ? global[CLR_BRIDGE_TAG] : new DotNetBridge();
  return global[CLR_BRIDGE_TAG];
}

const BridgeExports = GetBridgeInstance();
var all_Objects = [];
var callback_objects = [];
var saved_Objects = [];

function ExposeMethodsFromType(self, typeInfo) {
  function CreateMethod(self, method) {
    var invokeMethod = function () {
      return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0));
    };

    invokeMethod.Of = function () {
      var genericTypes = CreateClrTypeWrapper("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);

      for (var i = 0; i < arguments.length; ++i) {
        genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i);
      }

      var invokeGenericMethod = function () {
        return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes);
      };

      invokeGenericMethod.Box = function () {
        return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), genericTypes, true);
      };

      return invokeGenericMethod;
    };

    invokeMethod.Box = function () {
      return self.$Clr_Invoke(method.Name, Array.prototype.slice.call(arguments, 0), null, true);
    }; // Wire get_ and set_ to a property get/set.


    if (method.Name.startsWith("get_") && method.Parameters.length == 0 || method.Name.startsWith("set_") && method.Parameters.length == 1) {
      try {
        var shortMethodName = method.Name.slice("get_".length);
        Object.defineProperty(self, shortMethodName, {
          get: function () {
            return self.$Clr_Invoke("get_" + shortMethodName, []);
          },
          set: function (newValue) {
            return self.$Clr_Invoke("set_" + shortMethodName, [newValue]);
          }
        });
      } catch (e) {// console.warn("Can't define " + shortMethodName);
        // BUG: 'MaxWorkingSet may not be redefined.'
        // We can't overwrite reserved keywords.
      }
    } else if (method.Name.startsWith("add_") && method.Parameters && method.Parameters.length == 1 || method.Name.startsWith("remove_") && method.Parameters && method.Parameters.length == 1) {
      var shortMethodName = method.Name.substring(method.Name.startsWith("add_") ? "add_".length : "remove_".length);

      if (self[shortMethodName]) {
        return;
      }

      Object.defineProperty(self, shortMethodName, {
        get: function () {
          var EventHandler = new function () {
            this.add = function (delegate) {
              self.$Clr_Invoke("add_" + shortMethodName, [delegate]);
              return delegate;
            };

            this.remove = function (delegate) {
              // token = obj += delegate ... token is delegate.toString which is JSON by convention.
              if (typeof delegate == "string") {
                delegate = new ClrObjectWrapper(JSON.parse(delegate));
              }

              return self.$Clr_Invoke("remove_" + shortMethodName, [delegate]);
            }; // This makes it "" + other.toString() in the setter below when doing "handler += other"


            this.toString = function () {
              return "";
            };
          }();
          return EventHandler;
        },
        set: function (objHandle_string) {
          self.$Clr_Invoke("add_" + shortMethodName, [new ClrObjectWrapper(JSON.parse(objHandle_string))]);
        }
      });
    } else {
      self[method.Name] = invokeMethod;
    }
  }

  ;

  if (typeInfo.Methods) {
    for (var i = 0; i < typeInfo.Methods.length; ++i) {
      CreateMethod(self, typeInfo.Methods[i]);
    }
  }

  function ExposeField(self, name) {
    Object.defineProperty(self, name, {
      get: function () {
        return self.$Clr_Invoke(name, []);
      },
      set: function (value) {
        return self.$Clr_Invoke(name, [value]);
      }
    });
  }

  if (typeInfo.Fields) {
    for (var i = 0; i < typeInfo.Fields.length; ++i) {
      ExposeField(self, typeInfo.Fields[i]);
    }
  }
}

function ExposeNestedTypesFromType(self, typeInfo) {
  function CreateValue(self, name) {
    try {
      var shortName = name.replace(typeInfo.TypeName + "+", "");
      Object.defineProperty(self, shortName, {
        get: function () {
          return CreateClrTypeWrapper(name);
        }
      });
    } catch (e) {
      console.warn("Can't define " + name);
    }
  }

  ;

  if (typeInfo.NestedTypes) {
    for (var i = 0; i < typeInfo.NestedTypes.length; ++i) {
      CreateValue(self, typeInfo.NestedTypes[i]);
    }
  }
}

function CreateClrTypeWrapperFromInfo(typeInfo) {
  var ConstructorFunction = function () {
    // don't .slice (destroy) the callback argument.
    return BridgeExports.CreateObject(typeInfo, typeInfo.IsDelegate ? arguments[0] : Array.prototype.slice.call(arguments));
  };

  ConstructorFunction.$Clr_IsClrType = true;

  ConstructorFunction.$Clr_TypeOf = function () {
    return GetTypeByName(typeInfo.TypeName);
  };

  ConstructorFunction.$Clr_TypeInfo = typeInfo;

  ConstructorFunction.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
    return BridgeExports.InvokeMethod(null, typeInfo, method, args, genericTypes, returnBoxed);
  };

  ConstructorFunction.toString = function () {
    return "[ClrType " + typeInfo.TypeName + "]";
  }; // Could be overwritten.


  ConstructorFunction.Of = function () {
    var genericTypes = CreateClrTypeWrapper("System.Array").CreateInstance(GetTypeByName("System.Type"), arguments.length);

    for (var i = 0; i < arguments.length; ++i) {
      genericTypes.SetValue(arguments[i].$Clr_TypeOf(), i);
    }

    var genericType = CreateClrTypeWrapper(typeInfo.TypeName + "`" + arguments.length).$Clr_TypeOf().MakeGenericType(genericTypes);
    return CreateClrTypeWrapper(genericType.FullName);
  };

  ExposeMethodsFromType(ConstructorFunction, typeInfo); // Static

  ExposeNestedTypesFromType(ConstructorFunction, typeInfo); // Nested types

  return ConstructorFunction;
}

function CreateClrTypeWrapper(typeName, objHandle) {
  return CreateClrTypeWrapperFromInfo(BridgeExports.DescribeObject(typeName, objHandle));
}

function ClrObjectWrapper(objHandle) {
  var typeInfo = BridgeExports.DescribeObject(NULL, objHandle);
  this.$Clr_IsClrObject = true;
  this.$Clr_TypeInfo = typeInfo;
  this.$Clr_Handle = objHandle;

  this.$Clr_Invoke = function (method, args, genericTypes, returnBoxed) {
    return BridgeExports.InvokeMethod(objHandle, typeInfo, method, args, genericTypes, returnBoxed);
  };

  if (typeInfo.IsEnum) {
    this.value = typeInfo.EnumValue;

    this.toString = function () {
      return this.ToString();
    };
  } else if (typeInfo.IsDelegate) {
    // Used in event add_/remove_ for "+=" semantics.
    this.toString = function () {
      return JSON.stringify(objHandle);
    };
  } else {
    this.toString = function () {
      return "[ClrObject " + typeInfo.TypeName + ": " + this.ToString() + "]";
    };
  }

  ExposeMethodsFromType(this, typeInfo);
  all_Objects.push(this);
}

function GetTypeByName(typeName) {
  var type = CreateClrTypeWrapper("System.Type").GetType(typeName);
  if (type != null) return type;
  var asm = CreateClrTypeWrapper("System").AppDomain.CurrentDomain.GetAssemblies();
  var asmLength = asm.Length;

  for (var i = 0; i < asmLength; i++) {
    type = asm.GetValue(i).GetType(typeName);

    if (type != null) {
      return type;
    }
  }

  return null;
}

function JsonDelegate(func) {
  var callback = new NativeCallback(function (argsPtr) {
    // Unpack json args and resolve object references.
    var args = JSON.parse(Memory.readUtf16String(argsPtr));

    for (var i = 0; i < args.length; ++i) {
      if (args[i].__OBJECT) {
        args[i] = new ClrObjectWrapper(args[i]);
      }
    }

    var ret = func.apply(func, args); // Pack up the result into object references

    if (Object.prototype.toString.call(ret) === '[object Array]') {
      for (var i = 0; i < ret.length; ++i) {
        if (ret[i].$Clr_IsClrObject) {
          ret[i] = ret[i].$Clr_Handle;
        }
      }
    }

    if (ret) {
      if (ret.$Clr_IsClrObject) {
        ret = ret.$Clr_Handle;
      }

      return Memory.allocUtf16String(JSON.stringify(ret));
      ;
    }

    return NULL;
  }, 'pointer', ['pointer'], Win32.Abi); // If we don't do this, the GC is so quick it'll never be able to call back and AV.

  callback_objects.push(callback);
  return callback;
}

function GetNamespace(namespaceName) {
  return new function () {
    var namespaceInfo = BridgeExports.DescribeNamespace(namespaceName);
    this.$Clr_TypeInfo = namespaceInfo;

    function CreateProperty(self, leafName, isType, callback) {
      try {
        var is_mangled = false;
        var resolved_leaf_name = leafName;

        if (leafName.indexOf("`") > -1) {
          is_mangled = true;
          resolved_leaf_name = leafName.substring(0, leafName.indexOf("`"));
        }

        Object.defineProperty(self, resolved_leaf_name, {
          get: function () {
            return callback(resolved_leaf_name, isType, is_mangled);
          }
        });
      } catch (e) {// console.warn("couldn't define " + leafName + " on " + namespaceName + ":\n" + e);
      }
    }

    for (var i = 0; i < namespaceInfo.length; ++i) {
      CreateProperty(this, namespaceInfo[i].Name, namespaceInfo[i].IsType, function (leafName, isType, isMangled) {
        var fullLeafName = namespaceName + "." + leafName;

        if (isType) {
          if (isMangled) {
            // The problem is that we are given Func`1 and we can't be sure that Func will exist.
            // If it does, we need to use that, but if it doesn't, we need to hand back something that 
            // .Of(T) may be called on so that the generic types may still be accessed in either case.
            try {
              return CreateClrTypeWrapper(fullLeafName);
            } catch (e) {
              return CreateClrTypeWrapperFromInfo({
                TypeName: fullLeafName
              });
            }
          }

          return CreateClrTypeWrapper(fullLeafName);
        } else {
          return GetNamespace(fullLeafName);
        }
      });
    }
  }();
}

module.exports = {
  GetNamespace: GetNamespace,
  // Basic memory management, note callbacks are still leaked.
  Prune: function () {
    var outstanding = all_Objects.length;

    for (var i = outstanding - 1; i > -1; --i) {
      BridgeExports.ReleaseObject(all_Objects[i].$Clr_Handle);
    }

    all_Objects.length = 0;
    return outstanding;
  },
  Pin: function (obj) {
    all_Objects.splice(all_Objects.indexOf(obj), 1);
    saved_Objects.push(obj);
  }
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./com":5,"./guid":7,"./struct":8,"./win32":9}],7:[function(require,module,exports){
"use strict";

const Win32 = require('./win32');

var Ole32 = {
  CLSIDFromString: new NativeFunction(Module.findExportByName("ole32.dll", "CLSIDFromString"), 'uint', ['pointer', 'pointer'], Win32.Abi),
  StringFromGUID2: new NativeFunction(Module.findExportByName("ole32.dll", "StringFromGUID2"), 'int', ['pointer', 'pointer', 'int'], Win32.Abi)
};
const GUID_SIZE_BYTES = 16;
module.exports = {
  Size: GUID_SIZE_BYTES,
  alloc: function (guid_string) {
    if (guid_string.length == 32) {
      // 6fdf6ffced7794fa407ea7b86ed9e59d
      guid_string = "{" + guid_string.substr(0, 8) + "-" + raw_guid.substr(8, 4) + "-" + raw_guid.substr(12, 4) + "-" + raw_guid.substr(16, 4) + "-" + raw_guid.substr(20) + "}";
    } else if (guid_string.length == 36) {
      // 6fdf6ffc-ed77-94fa-407e-a7b86ed9e59d
      guid_string = "{" + guid_string + "}";
    } else if (guid_string.length == 38) {
      // {6fdf6ffc-ed77-94fa-407e-a7b86ed9e59d}
      guid_string = guid_string;
    } else {
      throw Error("Guid is in an unexpected or invalid format.");
    }

    var guidStructPtr = Memory.alloc(GUID_SIZE_BYTES);

    if (0 != Ole32.CLSIDFromString(Memory.allocUtf16String(guid_string), guidStructPtr)) {
      throw Error("Can't convert string '" + guid_string + "' to GUID.");
    }

    return guidStructPtr;
  },
  read: function (guid_ptr) {
    var cbGuidStr = 128; // bytes

    var guidBuffer = Memory.alloc(cbGuidStr);

    if (Ole32.StringFromGUID2(guid_ptr, guidBuffer, cbGuidStr / 2
    /* wchar_t */
    ) > 0) {
      return Memory.readUtf16String(guidBuffer);
    } else {
      throw Error('Failed to parse guid');
    }
  }
};

},{"./win32":9}],8:[function(require,module,exports){
var TypeMap = {
  'pointer': [Process.pointerSize, Memory.readPointer, Memory.writePointer],
  'char': [1, Memory.readS8, Memory.writeS8],
  'uchar': [1, Memory.readU8, Memory.writeU8],
  'int8': [1, Memory.readS8, Memory.writeS8],
  'uint8': [1, Memory.readU8, Memory.writeU8],
  'int16': [2, Memory.readS16, Memory.writeS16],
  'uint16': [2, Memory.readU16, Memory.writeU16],
  'int': [4, Memory.readS32, Memory.writeS32],
  'uint': [4, Memory.readU32, Memory.writeU32],
  'int32': [4, Memory.readS32, Memory.writeS32],
  'uint32': [4, Memory.readU32, Memory.writeU32],
  'long': [4, Memory.readS32, Memory.writeS32],
  'ulong': [4, Memory.readU32, Memory.writeU32],
  'float': [4, Memory.readFloat, Memory.writeFloat],
  'double': [8, Memory.readDouble, Memory.writeDouble],
  'int64': [8, Memory.readS64, Memory.writeS64],
  'uint64': [8, Memory.readU64, Memory.writeU64]
}; // Given a set of definitions, build an object with getters/setters around base_ptr.

var Struct = function (structInfo) {
  function LookupType(stringType) {
    for (var type in TypeMap) {
      if (stringType == type) {
        return TypeMap[type];
      }
    }

    throw Error("Didn't find " + JSON.stringify(stringType) + " in TypeMap");
  }

  var setter_result_cache = {};

  function CreateGetterSetter(self, name, type, offset) {
    Object.defineProperty(self, name, {
      get: function () {
        return LookupType(type)[1](base_ptr.add(offset));
      },
      set: function (newValue) {
        setter_result_cache[name] = LookupType(type)[2](base_ptr.add(offset), newValue);
      }
    });
  }

  ;

  function SizeOfType(stringType) {
    return LookupType(stringType)[0];
  }

  var base_ptr_size = 0;

  for (var member in structInfo) {
    var member_size = 0;

    if (member == "union") {
      var union = structInfo[member];

      for (var union_member in union) {
        var union_member_type = union[union_member];
        var union_member_size = SizeOfType(union_member_type);

        if (member_size < union_member_size) {
          member_size = union_member_size;
        }

        CreateGetterSetter(this, union_member, union_member_type, base_ptr_size);
      }
    } else {
      var member_size = SizeOfType(structInfo[member]);
      CreateGetterSetter(this, member, structInfo[member], base_ptr_size);
    }

    base_ptr_size += member_size;
  }

  var base_ptr = Memory.alloc(base_ptr_size);

  this.Get = function () {
    return base_ptr;
  };

  Object.defineProperty(this, "Size", {
    get: function () {
      return base_ptr_size;
    }
  });
};

module.exports = Struct;
module.exports.TypeMap = TypeMap;

},{}],9:[function(require,module,exports){
const Struct = require('./struct');

const GUID = require('./guid');

module.exports = {
  // Microsoft APIs use stdcall on x86.
  Abi: Process.arch == 'x64' ? 'win64' : 'stdcall'
};

},{"./guid":7,"./struct":8}]},{},[1])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJUZXN0LURvdE5ldEJyaWRnZS5qcyIsImxvY2FsX3NldHRpbmdzLmpzb24iLCIuLi9jb21tb24vRG90TmV0LWRlYnVnLmpzIiwiLi4vY29tbW9uL0RvdE5ldC5qcyIsIi4uL2NvbW1vbi9jb20uanMiLCIuLi9jb21tb24vZG90bmV0LmpzIiwiLi4vY29tbW9uL2d1aWQuanMiLCIuLi9jb21tb24vc3RydWN0LmpzIiwiLi4vY29tbW9uL3dpbjMyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUEsYSxDQUNBOztBQUVBLE9BQU8sQ0FBQyxHQUFSLENBQVksT0FBWjs7QUFFQSxNQUFNLGFBQWEsR0FBRyxPQUFPLENBQUMsa0JBQUQsQ0FBN0I7O0FBRUEsTUFBTSxHQUFHLEdBQUcsT0FBTyxDQUFDLGtCQUFELENBQW5COztBQUNBLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxZQUFKLENBQWlCLFFBQWpCLENBQWY7O0FBRUEsTUFBTSxRQUFRLEdBQUcsT0FBTyxDQUFDLHdCQUFELENBQXhCOztBQUNBLFFBQVEsQ0FBQyxtQkFBVCxHLENBRUE7O0FBQ0EsTUFBTSxDQUFDLFNBQVAsQ0FBaUIsTUFBakIsQ0FBd0IsS0FBeEIsQ0FBOEIsSUFBOUI7QUFDQSxNQUFNLENBQUMsV0FBUCxDQUFtQixLQUFuQixDQUF5QixTQUF6QixDQUFtQyxPQUFuQzs7QUFFQSxTQUFTLGVBQVQsQ0FBeUIsUUFBekIsRUFBbUMsTUFBbkMsRUFBMkM7QUFDMUMsRUFBQSxPQUFPLENBQUMsR0FBUixDQUFZLGFBQWEsUUFBYixHQUF3QixHQUF4QixHQUE4QixNQUExQzs7QUFDQSxNQUFJLE1BQU0sSUFBSSxRQUFkLEVBQXdCO0FBQ3ZCLFVBQU0sS0FBSyxDQUFDLGtEQUFrRCxRQUFsRCxHQUE2RCxZQUE3RCxHQUE0RSxNQUE3RSxDQUFYO0FBQ0E7QUFDRDs7QUFFRCxNQUFNLE9BQU8sR0FBRyxhQUFh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
