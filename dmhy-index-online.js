// ==UserScript==
// @name         DMHY新番資源索引 - 整合精簡版
// @namespace    no
// @version      1.0
// @description  整合ACGNTaiwan和Bangumi數據的新番索引，精簡顯示
// @author       deepsuck
// @match        https://www.dmhy.org/*
// @match        https://share.dmhy.org/*
// @match        https://dmhy.b168.net/*
// @match        https://dmhy.org/*
// @match        https://dmhy.anoneko.com/*
// @match        https://dmhy.gate.flag.moe/*
// @grant        GM_xmlhttpRequest
// @connect      api.bgm.tv
// @connect      raw.githubusercontent.com
// @license      MIT
// ==/UserScript==

//modified from https://github.com/rinsaika/dmhy-
(function() {
    'use strict';

    // 获取当前季节的JSON文件名
    function getCurrentSeasonFileName() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const seasonMonth = Math.floor((month - 1) / 3) * 3 + 1;
        return `anime${year}.${seasonMonth.toString().padStart(2, '0')}.json`;
    }

    // 获取Bangumi数据
    function fetchBangumiData() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: "https://api.bgm.tv/calendar",
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (e) {
                        reject('解析Bangumi数据失败:' + e);
                    }
                },
                onerror: function(error) {
                    reject('请求Bangumi数据失败:' + error);
                }
            });
        });
    }

    // 获取ACGNTaiwan数据
    function fetchACGNTaiwanData() {
        const fileName = getCurrentSeasonFileName();
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: `https://raw.githubusercontent.com/ACGNTaiwan/Anime-List/ddf669626df53e865bfa7034a133e479e486821d/anime-data/${fileName}`,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (e) {
                        reject('解析ACGNTaiwan数据失败:' + e);
                    }
                },
                onerror: function(error) {
                    reject('请求ACGNTaiwan数据失败:' + error);
                }
            });
        });
    }

    // 提取共同关键词（移除括号内容和季数信息）
    function extractCommonKeyword(nameTW, nameCN) {
        // 移除季数信息
        const cleanTW = nameTW.replace(/第[\d一二三四五六七八九十]+期/g, '')
                              .replace(/\([^)]*\)/g, '').trim();
        const cleanCN = nameCN.replace(/第[\d一二三四五六七八九十]+期/g, '')
                              .replace(/\([^)]*\)/g, '').trim();

        // 返回较短的版本（通常是更通用的名称）
        return cleanTW.length <= cleanCN.length ? cleanTW : cleanCN;
    }

    // 合并数据
    async function fetchAndCombineData() {
        try {
            const [bangumiData, acgnData] = await Promise.all([
                fetchBangumiData(),
                fetchACGNTaiwanData()
            ]);

            // 创建Bangumi名称到中文名称的映射
            const nameMap = {};
            bangumiData.forEach(week => {
                week.items.forEach(item => {
                    if (item.name_cn) {
                        nameMap[item.name] = item.name_cn;
                    }
                });
            });

            // 转换和合并数据
            const combinedEntries = acgnData.map(item => {
                const nameCN = nameMap[item.originalName || item.name] || item.name;
                const keyword = extractCommonKeyword(item.name, nameCN);

                // 从时间字符串解析小时和分钟
                const timeParts = item.time ? item.time.split(':') : [0, 0];
                const hours = parseInt(timeParts[0]) || 0;
                const minutes = parseInt(timeParts[1]) || 0;

                return {
                    nameJP: item.originalName || item.name,
                    nameTW: item.name,
                    nameCN: nameCN,
                    keyword: keyword,
                    timeValue: hours * 60 + minutes, // 转换为分钟数便于排序
                    day: parseDayFromDate(item.date), // 从日期字符串解析星期
                    link: `https://www.dmhy.org/topics/list?keyword=${encodeURIComponent(keyword)}`
                };
            });

            // 按时间和星期排序
            combinedEntries.sort((a, b) => {
                if (a.day !== b.day) return a.day - b.day;
                return a.timeValue - b.timeValue;
            });

            return combinedEntries;
        } catch (error) {
            console.error('获取或合并数据失败:', error);
            return [];
        }
    }

    // 从日期字符串解析星期（如"4/5"）
    function parseDayFromDate(dateStr) {
        if (!dateStr) return 0;

        try {
            const [month, day] = dateStr.split('/').map(Number);
            const date = new Date();
            date.setMonth(month - 1);
            date.setDate(day);
            return date.getDay(); // 0-6 (周日到周六)
        } catch (e) {
            return 0;
        }
    }

    function updateIndexTable(entries) {
        const table = document.querySelector('table.jmd');
        if (!table) return;

        // 清空原有内容
        table.querySelectorAll('tbody tr').forEach(row => row.remove());

        // 按星期分组
        const groupedEntries = Array.from({length: 7}, () => []);
        entries.forEach(entry => {
            if (entry.day >= 0 && entry.day < 7) {
                groupedEntries[entry.day].push(entry);
            }
        });

        // 生成新内容
        const today = new Date().getDay();
        groupedEntries.forEach((entries, dayIndex) => {
            if (entries.length === 0) return;

            const row = document.createElement('tr');
            row.className = getRowClass(dayIndex, today);

            // 星期标题
            const th = document.createElement('th');
            th.textContent = getWeekdayLabel(dayIndex);
            row.appendChild(th);

            // 番剧列表
            const td = document.createElement('td');
            entries.forEach(entry => {
                const link = document.createElement('a');
                link.href = entry.link;
                link.title = `${entry.nameJP}`;
                link.setAttribute("title-jp", entry.nameJP);
                link.setAttribute("title-cn", entry.nameCN);
                link.setAttribute("title-tw", entry.nameTW);
                link.textContent = [entry.nameTW, entry.nameCN, entry.nameJP].find(el => el); // Display TC name as primary
                td.appendChild(link);
                td.appendChild(document.createElement('br'));
            });
            row.appendChild(td);

            table.appendChild(row);
        });
    }

    function getRowClass(dayIndex, today) {
        if (dayIndex === today) return 'today';
        const diff = (dayIndex - today + 7) % 7;
        return diff === 1 || diff === 6 ? 'odd' : 'even';
    }

    function getWeekdayLabel(dayIndex) {
        const labels = ['週日（日）', '週一（月）', '週二（火）', '週三（水）', '週四（木）', '週五（金）', '週六（土）'];
        return labels[dayIndex];
    }

    function updateMarquee() {
        const marquee = document.getElementById('announce_marquee');
        if (marquee) {
            marquee.textContent = '▶️常態放送 Netflix Disney+ ABEMA +Ultra B站日配版｜*索引仅供参考';
        }
    }

    // 主执行函数
    async function main() {
        const entries = await fetchAndCombineData();
        if (entries.length > 0) {
            updateIndexTable(entries);
            updateMarquee();
        }
    }

    main();
})();
