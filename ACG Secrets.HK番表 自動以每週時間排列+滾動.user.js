// ==UserScript==
// @name         ACG Secrets.HK番表 自動以每週時間排列+滾動
// @namespace    https://github.com/harry0412xd/Tampermonkey-scripts
// @version      1.0
// @description  
// @author       You
// @match        https://acgsecrets.hk/bangumi/*/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=acgsecrets.hk
// ==/UserScript==

(function() {
    let weekRadio = document.getElementsByName("bgm_showmethod")[2];
    weekRadio.checked = true;
    weekRadio.click();
    setTimeout(()=>{
        document.querySelectorAll("h3.fullsize")[new Date().getDay()].scrollIntoView();
    },100)
})();