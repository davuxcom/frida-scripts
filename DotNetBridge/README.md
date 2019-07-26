# DotNetBridge

DotNetBridge is a C# component that is to be created via COM, from a Frida script.  This component exists because we can't create specific delegates without having a compiled assembly, and `CLRCreateInstance` requires a startup assembly.

The bridge is created as an in-process COM component in the target process.  The API is a JSON interface using full type names.  Object instances are cached and referened by `OBJECTREF` Id.

## Installation

- Open `Visual Studio` and build `DotNetBridge.sln` for both x86 and x64.
- Execute `register.cmd` (run elevated) to call `RegAsm` on the `DotNetBridge.dll` for both x86 and x64.  Once registered, any application can call `CoCreateInstance(CLSID_DotNetBridge)` to get an in-process bridge object.
- Consider running [Test-DotNetBridge](../Test-DotNetBridge) to validate the installation.

## API

The API consists of a primary object, IDotNetBridge, which is to be created exactly once per process.  All interactions are in JSON.

### DescribeNamespace(nameSpace)
Returns a JSON array of TypeInfo for a given Namespace.

### CreateObject(typeName, args)
Returns JSON value (includes OBJECTREF)

### DescribeObject(typeName, objRef)
Get JSON TypeInfo for a given full name.

### ReleaseObject(objRef)
Objects will be held indefinitely unless released.

### CreateDelegate(typeName, callback)
Create a suitable delegate matching typeName.

### InvokeMethod(objRef, typeName, methodName, args, genericTypesRef)
Returns JSON primitive or OBJECTREF.