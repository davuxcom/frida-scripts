"use strict";

function VERIFY_IS_NOTNULL(actual) {
	console.log("Verify NonNull: " + actual);
	if (!actual) {
		throw Error("----- FAILED -----\nVerify Failed\nActual: " + expected);
	}
}

function VERIFY_IS_EQUAL(expected, actual) {
	console.log("Verify: " + expected + " " + actual);
	if (actual != expected) {
		throw Error("----- FAILED -----\nVerify Failed\nExpected: " + expected + "\nActual: " + actual);
	}
}

function DECLARE_SUCCESS() {
    console.log("####################################");
    console.log("####################################");
    console.log("             SUCCESS");
    console.log("####################################");
    console.log("####################################");
}

module.exports = {
    VERIFY_IS_EQUAL: VERIFY_IS_EQUAL,
    VERIFY_IS_NOTNULL: VERIFY_IS_NOTNULL,
    DECLARE_SUCCESS: DECLARE_SUCCESS,
};