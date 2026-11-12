"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEELINGS = void 0;
exports.cleanHowItWent = cleanHowItWent;
exports.youtubeTagsFor = youtubeTagsFor;
exports.buildYoutubeDescription = buildYoutubeDescription;
// Builds the text that goes with a child's video on YouTube (and is reused for the "how it went" answers).
// Nov 2026: the planning sheet is reorganised into a readable description, and a few generic hashtags and
// keywords are added from MiniGuru's side. Nothing here ever includes a child's last name, school or contact detail:
// the child's own free text is only used if it passes the same personal-details check as shared ideas.
const ideaScreenService_1 = require("./ideaScreenService");
exports.FEELINGS = {
    LOVED: "😍 Loved making it",
    LIKED: "😊 Liked working on it",
    OKAY: "🙂 It was okay",
    HARD: "😓 It was hard work",
    JUST_FINISHED: "🏁 Just finished it",
};
// One place that validates the three optional answers, used for saving and for the description.
function cleanHowItWent(feeling, hoursTaken, wentWrong) {
    const out = {};
    if (typeof feeling === "string" && exports.FEELINGS[feeling])
        out.feeling = feeling;
    const h = Number(hoursTaken);
    if (Number.isFinite(h) && h >= 1 && h <= 500)
        out.hoursTaken = Math.round(h);
    if (typeof wentWrong === "string" && wentWrong.trim() && (0, ideaScreenService_1.patternScreen)(wentWrong).ok) {
        out.wentWrong = wentWrong.trim().slice(0, 300);
    }
    return out;
}
// YouTube does not allow < or > in a description. Hashtags: YouTube ignores all of them above 15, so we stay under.
const strip = (t) => String(t || "").replace(/<[^>]*>/g, "").replace(/[<>]/g, "");
function categoryHashtag(category) {
    const words = String(category || "").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 3);
    const tag = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
    return tag.length >= 3 ? "#" + tag : "";
}
const GENERIC_HASHTAGS = [
    "#MiniGuru", "#STEAM", "#STEM", "#ChildLedLearning", "#TinkeringLab", "#DIYProjects",
    "#KidsInnovation", "#LearnByDoing", "#IndiaKids",
];
function youtubeTagsFor(category) {
    const base = ["MiniGuru", "STEM", "STEAM", "Education", "India", "child-led learning", "tinkering", "T-LAB",
        "DIY projects", "kids projects", "learn by doing", "school projects"];
    const c = String(category || "").trim();
    return c ? [...base, c] : base;
}
function buildYoutubeDescription(opts) {
    const parts = [];
    parts.push(strip(opts.description).trim());
    const how = [];
    if (opts.how.feeling)
        how.push(exports.FEELINGS[opts.how.feeling]);
    if (opts.how.hoursTaken)
        how.push(`about ${opts.how.hoursTaken} hour${opts.how.hoursTaken === 1 ? "" : "s"} of making`);
    if (how.length)
        parts.push("🛠️ How it went: " + how.join(" · "));
    if (opts.how.wentWrong)
        parts.push("💡 What went wrong, or what I learned:\n" + strip(opts.how.wentWrong));
    if (opts.materialLines.length)
        parts.push("🧰 Materials used:\n" + opts.materialLines.map(strip).join("\n"));
    const meta = [];
    if (opts.category)
        meta.push("📂 Category: " + strip(opts.category));
    if (opts.planId)
        meta.push("📋 Planning sheet: " + strip(opts.planId));
    if (meta.length)
        parts.push(meta.join("\n"));
    parts.push("Made by a child on MiniGuru, where children plan, build and share real projects.\nLearn more: https://miniguru.in");
    const hashtags = [...GENERIC_HASHTAGS, categoryHashtag(opts.category)].filter(Boolean);
    parts.push(hashtags.join(" "));
    // YouTube's description limit is 5000 characters; keep a safe margin.
    return parts.filter(Boolean).join("\n\n").slice(0, 4800);
}
