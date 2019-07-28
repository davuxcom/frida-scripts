"use strict";

var Abi = Process.arch == 'x64' ? 'win64' : 'stdcall';
var Ole32 = {
    CLSIDFromString: new NativeFunction(Module.findExportByName("ole32.dll", "CLSIDFromString"), 'uint', ['pointer', 'pointer'], Abi),
    StringFromGUID2: new NativeFunction(Module.findExportByName("ole32.dll", "StringFromGUID2"), 'int', ['pointer', 'pointer', 'int'], Abi),
};
const GUID_SIZE_BYTES = 16;

module.exports = {
    Size: GUID_SIZE_BYTES,
    alloc: function (guid_string) {
        if (guid_string.length == 32) { // 6fdf6ffced7794fa407ea7b86ed9e59d
            guid_string = "{" + guid_string.substr(0, 8) + "-" + raw_guid.substr(8, 4) + "-" + raw_guid.substr(12, 4) + "-" + raw_guid.substr(16, 4) + "-" + raw_guid.substr(20) + "}";
        } else if (guid_string.length == 36) { // 6fdf6ffc-ed77-94fa-407e-a7b86ed9e59d
            guid_string = "{" + guid_string + "}";
        } else if (guid_string.length == 38) { // {6fdf6ffc-ed77-94fa-407e-a7b86ed9e59d}
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
        if (Ole32.StringFromGUID2(guid_ptr, guidBuffer, cbGuidStr / 2 /* wchar_t */) > 0) {
            return Memory.readUtf16String(guidBuffer);
        } else {
            throw Error('Failed to parse guid');
        }
    }
}
