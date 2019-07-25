const Struct = require('./struct');
const GUID = require('./guid');

module.exports = {
    // Microsoft APIs use stdcall on x86.
    Abi: Process.arch == 'x64' ? 'win64' : 'stdcall',
};