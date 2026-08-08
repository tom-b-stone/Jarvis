import { getPriorityLevel, isCriticalSender, shouldIgnoreEmail, getResponseDeadline, formatOutputByContext, isConfidentialSource } from "../src/config/tom-profile.js";
const cases: [string,string][] = [
  ["Jana.Marquardt@bmw.de","Wichtig"],
  ["no-reply@render.com","deploy failed for Jarvis"],
  ["no-reply@render.com","deploy succeeded"],
  ["Vanessa.Roettger@audif1.com","Re: Media advisory embargo"],
  ["noreply@audif1.com","R11 | Hungarian Grand Prix"],
  ["noreply@github.com","[GitHub] Sudo email verification code"],
  ["quentin.marquardt@icloud.com","Lauf morgen?"],
  ["noreply@medium.com","Daily digest"],
  ["dan@tldrnewsletter.com","GPT-5.6"],
  ["noreply@discogs.com","TomMarquardt - Shop New Wantlist Items for Sale"],
  ["info@service-mail.zalando.de","Danke für deine Bestellung"],
  ["shop@x.de","Ihre Rechnung zur Reklamation"],
];
for (const [s,sub] of cases) console.log(getPriorityLevel(s,sub).padEnd(9), getResponseDeadline(getPriorityLevel(s,sub)).toString().padEnd(8), s, "|", sub);
console.log("---");
console.log(isCriticalSender("Jana.Marquardt@bmw.de"), shouldIgnoreEmail("newsletter@monocle.com"), isConfidentialSource("Tobias.Bucher@audif1.com"));
console.log(formatOutputByContext("incident",{system:"Render",error:"Exited with status 1",time:"11:30",message:"Fix Vercel framework config"}));
