"use strict";
// The goal of this set of tests is to exercise the CLR helpers to create and interact with objects through the DotNetBridge.dll.

console.log("Begin");

const Test = require('../common/testutils');
const VERIFY_IS_EQUAL = Test.VERIFY_IS_EQUAL;

const localSettings = require('./local_settings');

// Uncomment this line to enable warnings:
//global.CLRDebug = true;
const CLR = require('../common/DotNet');
const System = new CLR.Namespace("System");

const CLRDebug = require('../common/DotNet-debug');
CLRDebug.EnableTraceListener();

// Wait for the background thread to start.
System.Threading.Thread.Sleep(1000);
System.Diagnostics.Trace.WriteLine("hello");

const asmPath = localSettings.ScriptRoot + "TestLibrary1.dll";
console.log("Loading " + asmPath);
System.Reflection.Assembly.LoadFile(asmPath);
const TestLibrary1 = new CLR.Namespace("TestLibrary1");

// Method
VERIFY_IS_EQUAL(TestLibrary1.Test1.TestMethod(), "TestMethod");
// Method<T>(T)
VERIFY_IS_EQUAL(TestLibrary1.Test1.TestGenericMethod.Of(System.IO.FileInfo)(new System.IO.FileInfo("f")),
 "System.IO.FileInfo");
// Method<T,V>(T, V)
VERIFY_IS_EQUAL(TestLibrary1.Test1.TestGenericMethod.Of(System.IO.FileInfo, System.Text.StringBuilder)(new System.IO.FileInfo("f"), new System.Text.StringBuilder()),
 "System.IO.FileInfo System.Text.StringBuilder");
 // Generic+Boxed
VERIFY_IS_EQUAL(TestLibrary1.Test1.TestGenericMethod.Of(System.IO.FileInfo, System.Text.StringBuilder).Box(new System.IO.FileInfo("f"), new System.Text.StringBuilder()).ToString(),
 "System.IO.FileInfo System.Text.StringBuilder");

// Static and instance fields
 
VERIFY_IS_EQUAL(TestLibrary1.Test1.Static5, 5);
TestLibrary1.Test1.Static5 = 7;
VERIFY_IS_EQUAL(TestLibrary1.Test1.Static5, 7);
var test1 = new TestLibrary1.Test1();
VERIFY_IS_EQUAL(test1.Instance5, 5);
test1.Instance5 = 4;
VERIFY_IS_EQUAL(test1.Instance5, 4);

// nested classes
var nested = new TestLibrary1.Test1.NestedClass();
VERIFY_IS_EQUAL(nested.Instance5, "5");

var twiceNested = new TestLibrary1.Test1.NestedClass.TwiceNestedClass();
VERIFY_IS_EQUAL(twiceNested.Instance7, "7");


// Boxing
VERIFY_IS_EQUAL(new System.Byte.Parse.Box("10").ToString(), "10");

// Test indexer
var dict = new System.Collections.Generic.Dictionary.Of(System.String, System.String)();
dict.Add("One", "OneValue");
VERIFY_IS_EQUAL(dict.get_Item("One"), "OneValue");
dict.set_Item("Two", "NewTwo")
VERIFY_IS_EQUAL(dict.get_Item("Two"), "NewTwo");

// further dictionary sanity check
VERIFY_IS_EQUAL(dict.Keys.Count, 2);
var dict_enum = dict.Values.GetEnumerator();
dict_enum.MoveNext();
dict_enum.MoveNext();
dict_enum.MoveNext();
VERIFY_IS_EQUAL(dict_enum.Current, null);

// Test property
var p = new System.Diagnostics.ProcessStartInfo();
p.Arguments = "testargs";
VERIFY_IS_EQUAL(p.Arguments, "testargs");

// Delegates

// Action
var didAct = false;
var act = new System.Action(function() {didAct=true;});
VERIFY_IS_EQUAL(act.Invoke() ? didAct : didAct, true);
 
didAct = false;
var act = new System.Action.Of(System.Boolean)(function(b) {didAct=true;});
VERIFY_IS_EQUAL(act.Invoke(true) ? didAct : didAct, true);

// Func<String,bool>
var fn = new System.Func.Of(System.String, System.Boolean)(function(str) { return true; });
VERIFY_IS_EQUAL(fn.Invoke("foo"), true);
// Func<bool,String>
var fn2 = new System.Func.Of(System.Boolean, System.String)(function(str) { return "foo"; });
VERIFY_IS_EQUAL(fn2 .Invoke(true), "foo");
// Func<String, FileInfo>
var fn3 = new System.Func.Of(System.String, System.IO.FileInfo)(function(str) {  return new System.IO.FileInfo(str); });
VERIFY_IS_EQUAL(fn3.Invoke("file_test.txt").Name, "file_test.txt");
// Func<FileInfo, String>
var fn4 = new System.Func.Of(System.IO.FileInfo, System.String)(function(fi) { return fi.Name;});
VERIFY_IS_EQUAL(fn4.Invoke(System.IO.FileInfo("file_test2.txt")), "file_test2.txt");

// Events

// Register
var asmLoaded = false;
var eventToken = System.AppDomain.CurrentDomain.AssemblyLoad += new System.AssemblyLoadEventHandler(function (s, e) { asmLoaded = true;});
System.Reflection.Assembly.LoadWithPartialName("PresentationFramework");
VERIFY_IS_EQUAL(asmLoaded, true);
// Unregister
System.AppDomain.CurrentDomain.AssemblyLoad.remove(eventToken);
asmLoaded = false;
System.Reflection.Assembly.LoadWithPartialName("System.Windows.Forms");
VERIFY_IS_EQUAL(asmLoaded, false); // will have generated loads

// Scenario test: thread
var apt = null;
var uiThread = new System.Threading.Thread(new System.Threading.ThreadStart(function() {
	apt = System.Threading.Thread.CurrentThread.ApartmentState;
	System.Threading.Thread.Sleep(500);
}));
uiThread.SetApartmentState(System.Threading.ApartmentState.STA);
uiThread.Start();
uiThread.Join();

VERIFY_IS_EQUAL(apt, "STA");
VERIFY_IS_EQUAL(System.Threading.ApartmentState.STA, "STA");

// Verify that System.Byte is auto-casted to an object instance (i.e. implicit typeof())
var arr = System.Array.CreateInstance(System.Byte, 10);
// Verify that a boxed value can be used for byte, since otherwise we fail to downcast from int.
arr.SetValue(System.Byte.Parse.Box("10"),0);

var Registry = new CLR.Namespace("Microsoft").Win32.Registry;

// Field
var sn = Registry.CurrentUser.OpenSubKey("Software").GetSubKeyNames();

// Ref param
var i = System.Int32.Parse.Box("5");
TestLibrary1.Test1.TestRef(i);
VERIFY_IS_EQUAL(i.ToString(), 10);
// out param
var io = System.Int32.Parse.Box("5");
TestLibrary1.Test1.TestOut(io);
VERIFY_IS_EQUAL(io.ToString(), 10);

// verify pinning
var io = System.Int32.Parse.Box("5");
CLR.Pin(io);
console.log("GC: " + CLR.Prune());
var objectNotFound = false;
try {
	i.ToString();
} catch(e) {
	objectNotFound = true;
}
io.ToString();
VERIFY_IS_EQUAL(objectNotFound, true);

Test.DECLARE_SUCCESS();
console.log("[*] Unloading...");
System.Threading.Thread.Sleep(1000);
System.Diagnostics.Process.GetCurrentProcess().Kill();