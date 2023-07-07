// ==UserScript==
// @name         Youtube Auto Not interested
// @namespace    https://github.com/harry0412xd/Tampermonkey-scripts
// @version      1.0
// @description  Auto click "Not interested" button if video title/uploader contains blacklisted word
// @author       harry
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @grant        none
// ==/UserScript==


(function() {
//----------------Configs

    const BlackList=["stream highlight","reaction","reacts to","hololive","vtuber","clips","highlight","anime"];
    const WhiteList=["cs:go","csgo"]
    const BlockFullyWatched = true;

//-----------------

    //button text language
    const Lang = document.querySelector(':root').getAttribute("lang");
    console.log(Lang);
    const notInterestText = {
        "zh-Hant-HK":"不推薦此頻道",
        "zh-Hant-TW":"不推薦此頻道",
        "en"        :"Not interested"

    }

    function querySelectorIncludesText(selector, text){
        return Array.from(document.querySelectorAll(selector))
            .find(el => el.textContent.includes(text));
    }


    const notInterested = (node,prevent_dup_func) => {
        let r = node.closest("ytd-rich-item-renderer").querySelector("button.style-scope.yt-icon-button")
        if (r===null){return}
        r.click();
        setTimeout(function(){
            try{
                //$("yt-formatted-string:contains('Not interested')").click();
                querySelectorIncludesText("yt-formatted-string", notInterestText[Lang]).click();
                prevent_dup_func();
            }catch(e){//not sure if this work
                let ytfs = querySelectorAll("yt-formatted-string");
                ytfs[ytfs.length-3].click();
            }
        }, 50);
    }

    setInterval(()=>{
        if (window.location.href!="https://www.youtube.com/"){return}
        let Nodes = document.querySelectorAll("#video-title, #channel-name");
        let timeout=0
        Nodes.forEach((node)=>{
                if (BlackList.some(keyword=>node.innerText.toLowerCase().includes(keyword)) 
                   &&!WhiteList.some(keyword=>node.innerText.toLowerCase().includes(keyword))){
                    setTimeout(function(){
                        notInterested(node, ()=>{node.id="not-interested";} );
                    }, timeout);
                    timeout += 200
                }
        });

        if (BlockFullyWatched) {
            Nodes = document.querySelectorAll("#progress[style*='width: 100%']");
            Nodes.forEach((node)=>{
                setTimeout(function(){
                         notInterested(node, ()=>{node.style.width='101%';} );
                    }, timeout);
                    timeout += 200
            });
        }

    },3000);

})();
