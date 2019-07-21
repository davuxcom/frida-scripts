console.log("Starting");

// Define API's from windows headers.
var CLSID_FileOpenDialog = Win32.GUID.alloc("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7");
var FOS_PICKFOLDERS	= 0x20;
var IFileDialog = new COM.Interface(COM.IUnknown, {
	Show: [0, ['uint']],
	SetOptions: [6, ['uint']],
	GetResult: [17, ['pointer']],
}, "42f85136-db7e-439c-85f1-e4075d135fc8");
var IShellItem = new COM.Interface(COM.IUnknown, {
}, "43826d1e-e718-42ee-bc55-a1e261c37bfe");
var SHBrowseForFolderPtr = Module.findExportByName('shell32.dll', 'SHBrowseForFolderW');
var SHBrowseForFolder = new NativeFunction(SHBrowseForFolderPtr, 'pointer', ['pointer']);
var SHGetIDListFromObject = new NativeFunction(Module.findExportByName('shell32.dll', 'SHGetIDListFromObject'), 'uint', ['pointer','pointer']);
var BIF_EDITBOX = (0x00000010);
var BIF_NEWDIALOGSTYLE = (0x00000040);
var BIF_RETURNONLYFSDIRS = (0x00000001);


// Intercept and replace SHBrowseForFolderW
Interceptor.replace(SHBrowseForFolderPtr, new NativeCallback(function (browseinfoPtr) {
    console.log("SHBrowseForFolderW Entry");

	var browseinfo = new Win32.Struct({ // BROWSEINFO
			'hwndOwner':'int',
			'pidlRoot':'pointer',
			'pszDisplayName':'pointer',
			'lpszTitle':'pointer',
			'ulFlags':'uint',
			'lpfn':'pointer',
			'lParam':'long',
			'iImage':'int',
		}, browseinfoPtr);
	console.log("SHBrowseForFolderW ulFlags: 0x" + browseinfo.ulFlags.toString(16));

	// Per the docs, COM should already be initialized but this wasn't the case when testing against a real app.
	COM.Initialize(COM.ApartmentType.STA);
	
	// Create and show the replacement dialog
	var modalWindow = COM.CreateInstance(CLSID_FileOpenDialog, COM.ClassContext.InProc, IFileDialog);
	modalWindow.SetOptions(FOS_PICKFOLDERS);
	modalWindow.Show(browseinfo.hwndOwner);
	var shellItem = new COM.Pointer(IShellItem);
	COM.ThrowIfFailed(modalWindow.GetResult(shellItem.GetAddressOf()));

	// Convert IShellItem result to an idlist to return to SHBrowseForFolderW.
	var pidl = Memory.alloc(Process.pointerSize);
	COM.ThrowIfFailed(SHGetIDListFromObject(shellItem.Get(), pidl));
	
	console.log("SHBrowseForFolderW Exit pidl=" + pidl);
    return Memory.readPointer(pidl);
}, 'pointer', ['pointer'], Win32.Abi));

console.log("Ready");