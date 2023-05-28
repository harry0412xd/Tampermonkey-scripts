// ==UserScript==
// @name         Metasrc LoL auto kr & dia+
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Redirect
// @author       You
// @match        https://www.metasrc.com/aram/*champion/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=metasrc.com
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    let href = window.location.href;
    href = href.replace("aram/champion","aram/kr/champion").replace("/na/","/kr/");;
    if (!href.includes("ranks")){
        href += "?ranks=diamond,master,grandmaster,challenger"
    }
    if (href!= window.location.href){
        window.location.href = href;
    }
})();