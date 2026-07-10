-- PVE 全對弈階梯設計（documents/PVE-全對弈階梯設計-2026-07-10.md §3.2/§9.1）:
-- L8 "SKILL_DEMON" 魔王的三個弓箭手技能（精準狙擊/散射/開拓之星）各只有一次
-- charge、沒有回充。與其在每次 Boss 決策時掃描/解析整條 SKILL_USED 事件 JSON
-- 判斷是否已使用過，直接在 pve_encounters 上加 3 個 charge-used 旗標欄位：
-- O(1) 讀取、與現有 minor_disruption_triggered 同一種「一次性旗標」慣例一致。
-- 只有 sequence=8 的 encounter 會真正翻動這三欄；其餘關卡永遠是預設值 false。

ALTER TABLE pve_encounters
    ADD COLUMN boss_pioneer_used BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pve_encounters
    ADD COLUMN boss_sniper_used BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pve_encounters
    ADD COLUMN boss_scatter_used BOOLEAN NOT NULL DEFAULT false;
