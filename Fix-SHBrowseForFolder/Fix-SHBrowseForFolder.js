
function GetAbi() { return Process.arch == 'x64' ? 'win64' : 'stdcall'; }

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

Interceptor.replace(SHBrowseForFolderPtr, new NativeCallback(function (browseinfoPtr) {
    console.log("SHBrowseForFolder Entry");

	var BIF_EDITBOX = (0x00000010);
	var BIF_NEWDIALOGSTYLE = (0x00000040);
	var BIF_RETURNONLYFSDIRS = (0x00000001);
	var browseinfo = new Struct({ // BROWSEINFO
			'hwndOwner':'int',
			'pidlRoot':'pointer',
			'pszDisplayName':'pointer',
			'lpszTitle':'pointer',
			'ulFlags':'uint',
			'lpfn':'pointer',
			'lParam':'long',
			'iImage':'int',
		}, browseinfoPtr);
	console.log("Flags: 0x" + browseinfo.ulFlags.toString(16));

	COM.Initialize(COM.ApartmentType.STA);
	
	var modalWindow = COM.CreateInstance(CLSID_FileOpenDialog, COM.ClassContext.InProc, IFileDialog);
	modalWindow.SetOptions(FOS_PICKFOLDERS);
	modalWindow.Show(browseinfo.hwndOwner);

	var shellItem = new COM.Pointer(IShellItem);
	COM.ThrowIfFailed(modalWindow.GetResult(shellItem.GetAddressOf()));

	var pidl = Memory.alloc(Process.pointerSize);
	COM.ThrowIfFailed(SHGetIDListFromObject(shellItem.Get(), pidl));
	
	console.log("SHBrowseForFolder Exit " + pidl);
	
    return Memory.readPointer(pidl);
}, 'pointer', ['pointer'], GetAbi()));

console.log("Ready");