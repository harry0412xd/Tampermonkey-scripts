// ==UserScript==
// @name         Youtube Auto Not interested
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Auto click "Not interested" button if video title/uploader contains blacklisted word
// @author       You
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @require https://code.jquery.com/jquery-3.6.0.min.js
// @grant        none
// ==/UserScript==

//----------------Configs

const BlackList=["stream highlight","tiktok", "reaction","reacting to","reacts ","hololive","vtuber","clips","highlight","anime"];
const WhiteList=["cs:go","csgo"]
const BlockFullyWatched = true;

//-----------------
//button text language
const Lang = document.querySelector(':root').getAttribute("lang");
console.log(Lang);
const dontRecommendText = {
    "zh-Hant-HK":"不推薦此頻道",
    "zh-Hant-TW":"不推薦此頻道",
    //"en"        :"Do not recommend"

}
const notInterestText = {
    "zh-Hant-HK":"沒有興趣",
    "zh-Hant-TW":"沒有興趣",
    "en"        :"Not interested"

}

function querySelectorIncludesText(selector, text){
    return Array.from(document.querySelectorAll(selector))
        .find(el => el.textContent.includes(text));
}

const notInterested = (node,prevent_dup_func) => {
    try{
        let r = node.closest("ytd-rich-item-renderer").querySelector("button.style-scope.yt-icon-button")
        if (r===null){return}
        r.click();
        setTimeout(function(){
            try{
                //throw new Error("use fallback");
                querySelectorIncludesText("yt-formatted-string", notInterestText[Lang]).click();
                prevent_dup_func();
            }catch(e){//not sure if this work
                let ytfs = document.querySelectorAll("yt-formatted-string");
                if (ytfs.length==8){
                    ytfs[ytfs.length-3].click();
                }else{
                    document.querySelector("#container").click();
                }
                prevent_dup_func();
            }
        }, 50);
    }catch(e){
        console.error(e)
        node.id="error";
    }

}

function mainFunction(){
/*     console.log("checking"); */
    let Nodes = document.querySelectorAll("#video-title, #channel-name");
    let timeout=0
    Nodes.forEach((node)=>{
        const videoTitleOrChannelName = node.innerText.toLowerCase();
        if (BlackList.some(keyword=>videoTitleOrChannelName.includes(keyword))
            && !WhiteList.some(keyword=>videoTitleOrChannelName.includes(keyword))){
            console.log(videoTitleOrChannelName);
            setTimeout(function(){
                notInterested(node, ()=>{node.id="not-interested";} );
            }, timeout);
            timeout += 100
        }
    });

    if (BlockFullyWatched) {
        Nodes = document.querySelectorAll("#progress[style*='width: 100%']");
        Nodes.forEach((node)=>{
            setTimeout(function(){
                notInterested(node, ()=>{node.style.width='101%';} );
            }, timeout);
            timeout += 100
        });
    }

    if (window.location.href=="https://www.youtube.com/"){
        setTimeout(mainFunction, 1000);
    }else{
        const observer = setInterval(()=>{
            if (window.location.href=="https://www.youtube.com/"){
                clearInterval(observer);
                mainFunction();
            }
            console.log("waiting");
        }, 1000);
    }
}

(function() {
    mainFunction();
})();
