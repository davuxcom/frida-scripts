"use strict";

// GOAL: Run code on WinRT UI thread, intercept app going fullscreen and undo it.

global.COMDebug = true;
const Test = require('../common/testutils');
const VERIFY_IS_EQUAL = Test.VERIFY_IS_EQUAL;
const VERIFY_IS_NOTNULL = Test.VERIFY_IS_NOTNULL;

const COM = require("../common/com");
const WinRT = require("../common/winrt");

// These interfaces are from the ABI variant, found in Windows Kits\10\Include\10.0.17763.0\winrt\windows.ui.core.h

var ICoreImmersiveApplication = new COM.Interface(COM.IInspectable, {
    get_MainView: [2, ['pointer']],
}, "1ADA0E3E-E4A2-4123-B451-DC96BF800419");

var ICoreApplicationView = new COM.Interface(COM.IInspectable, {
	get_CoreWindow: [0, ['pointer']],
}, "638BB2DB-451D-4661-B099-414F34FFB9F1");

var ICoreWindow = new COM.Interface(COM.IInspectable, {
	get_Dispatcher: [3, ['pointer']],
    GetAsyncKeyState: [14, ['int','pointer']],
    GetKeyState: [15, ['int', 'pointer']],
    add_KeyDown: [29, ['pointer', 'pointer']],
    remove_KeyDown: [30, ['int64']],
}, "79B9D5F2-879E-4B89-B798-79E47598030C");

var CoreDispatcherPriority = {
	Normal: 0,
}
var ICoreDispatcher = new COM.Interface(COM.IInspectable, {
	RunAsync: [2, ['int', 'pointer', 'pointer']],
}, "60DB2FA8-B705-4FDE-A7D6-EBBB1891D39E");

var IDispatchedHandler = new COM.Interface(COM.IUnknown, {
	Invoke: [0, []],
}, "D1F276C4-98D8-4636-BF49-EB79507548E9");

var IApplicationViewStatics2 = new COM.Interface(COM.IInspectable, {
	GetForCurrentView: [0, ['pointer']],
}, "AF338AE5-CF64-423C-85E5-F3E72448FB23");

var IApplicationView = new COM.Interface(COM.IInspectable, {
	put_Title: [7, ['pointer']],
}, "D222D519-4361-451E-96C4-60F4F9742DB0");

var IApplicationView2 = new COM.Interface(COM.IInspectable, {
    add_VisibleBoundsChanged: [3, ['pointer','pointer']]
}, "E876B196-A545-40DC-B594-450CBA68CC00");

var IApplicationView3 = new COM.Interface(COM.IInspectable, {
	TryEnterFullScreenMode: [4, ['pointer']],
	ExitFullScreenMode: [5, []],
}, "903C9CE5-793A-4FDF-A2B2-AF1AC21E3108");

function GetMainXamlWindow() {
	var coreApplication = WinRT.GetActivationFactory("Windows.ApplicationModel.Core.CoreApplication", ICoreImmersiveApplication);
	var mainView = new COM.Pointer(ICoreApplicationView);
	COM.ThrowIfFailed(coreApplication.get_MainView(mainView.GetAddressOf()));
	var coreWindow = new COM.Pointer(ICoreWindow);
	COM.ThrowIfFailed(mainView.get_CoreWindow(coreWindow.GetAddressOf()));
	return coreWindow;
}

function RunOnXAMLUIThread(callback) {
	var coreWindow = GetMainXamlWindow();
	var coreDispatcher = new COM.Pointer(ICoreDispatcher);
	COM.ThrowIfFailed(coreWindow.get_Dispatcher(coreDispatcher.GetAddressOf()));

	var dispatcherFrame = new COM.RuntimeObject(IDispatchedHandler.IID);
	// HRESULT IDispatchedHandler.Invoke(void);
	dispatcherFrame.AddEntry(function (this_ptr) { callback(); return COM.S_OK; }, 'uint', ['pointer']);

	COM.ThrowIfFailed(coreDispatcher.RunAsync(CoreDispatcherPriority.Normal, dispatcherFrame.GetAddress(), Memory.alloc(Process.pointerSize)));
}

console.log("[*] Initializing WinRT....");
WinRT.Initialize();

RunOnXAMLUIThread(function () {
    console.log("[*] Locating main window....");
    var coreWindow = GetMainXamlWindow();
    
    VERIFY_IS_NOTNULL(coreWindow.GetIids());
    VERIFY_IS_EQUAL(coreWindow.GetRuntimeClassName(), "Windows.UI.Core.CoreWindow");
    VERIFY_IS_EQUAL(coreWindow.GetTrustLevel(), "BaseTrust");

    var appViewStatics = WinRT.GetActivationFactory("Windows.UI.ViewManagement.ApplicationView", IApplicationViewStatics2);
    var appView = new COM.Pointer(IApplicationView);
    COM.ThrowIfFailed(appViewStatics.GetForCurrentView(appView.GetAddressOf()));
    
    console.log("[*] Attaching event handlers");
    var appView2 = appView.As(IApplicationView2);
    var token = new WinRT.EventRegistrationToken();
    COM.ThrowIfFailed(appView2.add_VisibleBoundsChanged(new WinRT.TypedEventHandler(function(s, e) {
        console.log("VisibleBoundschnaged " + e);
    }, "00c1f983-c836-565c-8bbf-7053055bdb4c"), token.Get()));
    
    var appView3 = appView.As(IApplicationView3);
    Interceptor.attach(appView3.TryEnterFullScreenMode.GetAddressOf(), {
        onLeave: function (retval) {
            console.log("[*] IApplicationView3::TryEnterFullScreenMode OnLeave");
            var VirtualKey_Control = 17;
            var keyState = Memory.alloc(4);
            COM.ThrowIfFailed(coreWindow.GetAsyncKeyState(VirtualKey_Control, keyState));
            var keyStateValue = Memory.readInt(keyState);
            if (keyStateValue == 0) {
                setTimeout(function() {
                    RunOnXAMLUIThread(function () {
                        console.log("[*] Calling ExitFullScreenMode");
                        COM.ThrowIfFailed(appView3.ExitFullScreenMode());

                        Test.DECLARE_SUCCESS();
                    });
                }, 250); // need a short delay otherwise the app doesn't transition.
            } else {
                console.warn("Skipping fullscreen, CTRL is down.");
            }
        }
    });
    // For verification, toggle fullscreen
    COM.ThrowIfFailed(appView3.TryEnterFullScreenMode(Memory.alloc(Process.pointerSize)));
});
