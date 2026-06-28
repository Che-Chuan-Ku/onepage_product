"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/until-async";
exports.ids = ["vendor-chunks/until-async"];
exports.modules = {

/***/ "(ssr)/./node_modules/until-async/lib/index.js":
/*!***********************************************!*\
  !*** ./node_modules/until-async/lib/index.js ***!
  \***********************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   until: () => (/* binding */ until)\n/* harmony export */ });\n//#region src/index.ts\n/**\n* Gracefully handles a callback that returns a promise.\n*\n* @example\n* await until(() => Promise.resolve(123))\n* // [null, 123]\n*\n* await until(() => Promise.reject(new Error('Oops!')))\n* // [new Error('Oops!'), null]\n*/\nasync function until(callback) {\n\ttry {\n\t\treturn [null, await callback().catch((error) => {\n\t\t\tthrow error;\n\t\t})];\n\t} catch (error) {\n\t\treturn [error, null];\n\t}\n}\n\n//#endregion\n\n//# sourceMappingURL=index.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvdW50aWwtYXN5bmMvbGliL2luZGV4LmpzIiwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxHQUFHO0FBQ0gsR0FBRztBQUNIO0FBQ0E7QUFDQTs7QUFFQTtBQUNpQjtBQUNqQiIsInNvdXJjZXMiOlsid2VicGFjazovL2dvbW9rdS1mcm9udGVuZC8uL25vZGVfbW9kdWxlcy91bnRpbC1hc3luYy9saWIvaW5kZXguanM/Y2E1YyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL2luZGV4LnRzXG4vKipcbiogR3JhY2VmdWxseSBoYW5kbGVzIGEgY2FsbGJhY2sgdGhhdCByZXR1cm5zIGEgcHJvbWlzZS5cbipcbiogQGV4YW1wbGVcbiogYXdhaXQgdW50aWwoKCkgPT4gUHJvbWlzZS5yZXNvbHZlKDEyMykpXG4qIC8vIFtudWxsLCAxMjNdXG4qXG4qIGF3YWl0IHVudGlsKCgpID0+IFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignT29wcyEnKSkpXG4qIC8vIFtuZXcgRXJyb3IoJ09vcHMhJyksIG51bGxdXG4qL1xuYXN5bmMgZnVuY3Rpb24gdW50aWwoY2FsbGJhY2spIHtcblx0dHJ5IHtcblx0XHRyZXR1cm4gW251bGwsIGF3YWl0IGNhbGxiYWNrKCkuY2F0Y2goKGVycm9yKSA9PiB7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9KV07XG5cdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0cmV0dXJuIFtlcnJvciwgbnVsbF07XG5cdH1cbn1cblxuLy8jZW5kcmVnaW9uXG5leHBvcnQgeyB1bnRpbCB9O1xuLy8jIHNvdXJjZU1hcHBpbmdVUkw9aW5kZXguanMubWFwIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/until-async/lib/index.js\n");

/***/ })

};
;