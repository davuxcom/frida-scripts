
var TypeMap = {
    'pointer': [Process.pointerSize, Memory.readPointer, Memory.writePointer],
    'char': [1, Memory.readS8, Memory.writeS8], 'uchar': [1, Memory.readU8, Memory.writeU8],
    'int8': [1, Memory.readS8, Memory.writeS8], 'uint8': [1, Memory.readU8, Memory.writeU8],
    'int16': [2, Memory.readS16, Memory.writeS16], 'uint16': [2, Memory.readU16, Memory.writeU16],
    'int': [4, Memory.readS32, Memory.writeS32], 'uint': [4, Memory.readU32, Memory.writeU32],
    'int32': [4, Memory.readS32, Memory.writeS32], 'uint32': [4, Memory.readU32, Memory.writeU32],
    'long': [4, Memory.readS32, Memory.writeS32], 'ulong': [4, Memory.readU32, Memory.writeU32],
    'float': [4, Memory.readFloat, Memory.writeFloat], 'double': [8, Memory.readDouble, Memory.writeDouble],
    'int64': [8, Memory.readS64, Memory.writeS64], 'uint64': [8, Memory.readU64, Memory.writeU64],
};

// Given a set of definitions, build an object with getters/setters around base_ptr.
var Struct = function (structInfo) {
    function LookupType(stringType) {
        for (var type in TypeMap) { if (stringType == type) { return TypeMap[type]; } }
        throw Error("Didn't find " + JSON.stringify(stringType) + " in TypeMap");
    }

    var setter_result_cache = {};
    function CreateGetterSetter(self, name, type, offset) {
        Object.defineProperty(self, name, {
            get: function () { return LookupType(type)[1](base_ptr.add(offset)); },
            set: function (newValue) { setter_result_cache[name] = LookupType(type)[2](base_ptr.add(offset), newValue); }
        });
    };

    function SizeOfType(stringType) { return LookupType(stringType)[0]; }

    var base_ptr_size = 0;
    for (var member in structInfo) {
        var member_size = 0;
        if (member == "union") {
            var union = structInfo[member];
            for (var union_member in union) {
                var union_member_type = union[union_member];
                var union_member_size = SizeOfType(union_member_type);
                if (member_size < union_member_size) { member_size = union_member_size; }
                CreateGetterSetter(this, union_member, union_member_type, base_ptr_size);
            }
        } else {
            var member_size = SizeOfType(structInfo[member]);
            CreateGetterSetter(this, member, structInfo[member], base_ptr_size);
        }
        base_ptr_size += member_size;
    }

    var base_ptr = Memory.alloc(base_ptr_size);

    this.Get = function () { return base_ptr; }
    Object.defineProperty(this, "Size", { get: function () { return base_ptr_size; } });
}

module.exports = Struct;
module.exports.TypeMap = TypeMap;