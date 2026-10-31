# Usability study seed: content for review

Prepared 2026-10-31 for the deployed HateGuard app (`https://hateguard.vercel.app`, API on the Azure VM). **Nothing has been seeded yet.** Once you approve, the seed script will insert exactly what this file lists.

**Content warning:** the Abuse and Hate posts below contain real insults and ethnic slurs from the AfriHate dataset.

## 1. Summary

| Item | Proposed value |
|---|---|
| Organization | **HateGuard Study Forum** (fictional, and clearly part of the study) |
| Posts | 30 in total: 15 Igbo and 15 Yoruba. In each language, 5 Normal, 5 Abuse and 5 Hate. |
| Source of the posts | AfriHate (published dataset): 29 from our test split and 1 from our dev split (Yoruba Hate, see 4.3) |
| Labels and probabilities | From the deployed models, computed on the VM on 2026-10-31. The gold label, the model's label and the category agree for all 30. |
| Source shown in the dashboard | `batch`, which is what a real batch upload records. The dataset split is not shown. |
| Triage state | All posts start as pending: none flagged, none relabelled. |
| Participant login | One study account in this organization, `participant@hateguard.test` (see question 2). You type its password during seeding; it is never written to a file. |
| Your own account | Unchanged. As platform admin you can switch into the study organization. |

## 2. How the seed preserves data quality

Each post had to pass all of these checks:
1. **Gold label equals the category.** The label comes from the dataset CSVs in `model_training/dataset/`.
2. **The deployed model agrees, with high confidence.** All 30 were classified on the VM by the exact model revisions in production (Igbo `21390bab`, Yoruba `bd3f382f`). Each has the expected label with probability ≥ 0.97. The test-split values also match the stored `predictions_test.csv`.
3. **Readable, and mainly in the right language.** At least 7 words for most posts. Few English words, no `##url` placeholder where an alternative existed, and no duplicates.
4. **Clearly in its class on reading.** I left out posts whose gold label looks wrong (see section 5).
   - Normal posts are neutral: greetings, proverbs, blessings and food.
   - Abuse posts insult an individual, not a group.
   - Hate posts attack an ethnic group.
5. **No personal data, and no named politicians in the Abuse posts.**
6. **AfriHate only.** I did not use the second-wave Facebook (Meta Content Library) posts, because the data documentation says to check the MCL terms before any data release. A public dashboard counts as a release.

The "Why it fits" notes are **my reading. Please verify them**, especially the Yoruba ones.

## 3. Timestamps (the same pattern in both languages)

Times are set relative to the moment of seeding. That way each run looks the same to every participant.

| When (before seeding) | Normal | Abuse | Hate | Posts that day |
|---|---|---|---|---|
| 25 minutes (session language) or 70 minutes (other language) | | | 1 (creates the T9 alert in the session language) | 2 |
| 3 hours | | 1 | | (same day) |
| 1 day | 1 | | | 1 |
| 2 days | | | 1 | 1 |
| 4 days | 1 | 1 | | 2 |
| 6 days | | | 1 | 1 |
| **9 days (busiest day)** | 1 | 2 | 1 | **4** |
| 13 days | 1 | | | 1 |
| 18 days | | 1 | | 1 |
| 23 days | | | 1 | 1 |
| 27 days | 1 | | | 1 |

Expected answers, per language, if seeding runs within an hour before the session:
- **T2:** 3 Hate posts in the last 7 days, out of 7 posts in total. The busiest day in the last month is 9 days ago, with 4 posts.
- **T3:** every Hate post has P(Hate) ≥ 0.99, and every other post has P(Hate) ≤ 0.01. So "P(Hate) ≥ 70% in a date range" equals the number of Hate posts in that range.
- **T9:** the newest Hate post (Igbo `test_igbo_00350`, Yoruba `dev_yoruba_00581`) has P(Hate) ≥ 0.9. Alerts are only created for posts from the last hour, and they belong to the organization, not to a language. So the seed places only the **session language's** post 25 minutes ago. The other language's post goes 70 minutes ago: still the same day, but too old for an alert. The participant then sees exactly one "High-confidence hate detected" alert, in their own language, the first time the dashboard checks for alerts. T2 and T3 answers are not affected.

**Seed between 10:00 and 19:00 Halifax time.** Each day's posts then share one calendar date in both UTC and local time. As before, read the answer key from the dashboard at task time.

## 4. The posts

### 4.1 Igbo

**Normal**

| # | Posted | Dataset ID | Text (verbatim) | P(Normal) | P(Abuse) | P(Hate) | Why it fits (my reading) |
|---|---|---|---|---|---|---|---|
| 1 | 1 day ago | `test_igbo_00334` | ọ kwa nwata zọwa nke ya,  ọ bụrụ ajọ nwa. e sokwa m na-ekwusi ike sị o,  "egbe bere, ugo bere ma nke sị ibe ya ebena nku kwaa ya." | 0.997 | 0.003 | 0.000 | Proverb (*egbe bere, ugo bere*: let the kite perch and let the eagle perch) |
| 2 | 4 days ago | `test_igbo_00642` | anyị nwere ike ịhụ na asụsụ anyị nwere ike ịnwụ. ka anyi lee ihe anyi nwere ike ime iji mee ka asusu anyi di ndu.   #igbonotindonesian #africanlanguagesmatter #smwlagos #africanlanguages #igbo #culturalpreservation | 0.995 | 0.005 | 0.000 | About keeping the Igbo language alive |
| 3 | 9 days ago | `test_igbo_00125` | happy birthday boss @username , olisa kpuchibe gị ka ọkụkọ si ekpuchi ụmụ ya. | 0.993 | 0.007 | 0.000 | Birthday blessing |
| 4 | 13 days ago | `test_igbo_00340` | ngọzi na-adịrị ndị agụụ na-agụ, ndị akpịrị na-akpọkwa nkụ maka ezi omume, n’ihi na a ga-eme ka afọ ju ha..- matiu 5:6 | 0.996 | 0.004 | 0.000 | Bible verse (Matthew 5:6) |
| 5 | 27 days ago | `test_igbo_00093` | judi judi isi ewu obu ego ole ?  chicken na ugba agwọlu agwọ fa ncha ọbu ego ole ? 😒😒😒 | 0.988 | 0.012 | 0.000 | Asks food prices; *isi ewu* is the dish here, not the insult |

**Abuse**

| # | Posted | Dataset ID | Text (verbatim) | P(Normal) | P(Abuse) | P(Hate) | Why it fits (my reading) |
|---|---|---|---|---|---|---|---|
| 6 | 3 h ago | `test_igbo_00540` | @username anu ohia rere ere. udele a buru onu. nkita ara. | 0.002 | 0.997 | 0.001 | Personal insults (*anụ ọhịa*, *udele*, *nkịta ara*) |
| 7 | 4 days ago | `test_igbo_00549` | @username u dey craze, iibu onye ara, anuofia, nkita ara, | 0.002 | 0.997 | 0.001 | Personal insults (*onye ara*, *anụ ọhịa*, *nkịta ara*) |
| 8 | 9 days ago | `test_igbo_00403` | @username , mechie eze ule gi there osiso. | 0.003 | 0.996 | 0.001 | "Shut your rotten teeth" (*mechie eze ule gị*) |
| 9 | 9 days ago | `test_igbo_00221` | @username anụmanụ, iche nọ i na akogheri, nkịta rifọrọ gị nsị, onye mgbu! | 0.003 | 0.996 | 0.001 | Personal insults (*anụmanụ*, *onye mgbu*) |
| 10 | 18 days ago | `test_igbo_00242` | @username isi okpo... onye nzuzu. isi ewu... ne imi gi ks ite bean. ne eze gi ks fork ndi ori! | 0.002 | 0.996 | 0.001 | Insults about looks and sense (*isi okpo*, *onye nzuzu*, *isi ewu*) |

**Hate**

| # | Posted | Dataset ID | Text (verbatim) | P(Normal) | P(Abuse) | P(Hate) | Why it fits (my reading) |
|---|---|---|---|---|---|---|---|
| 11 | 25 min ago | `test_igbo_00350` | @username ndi ofe mmanu can never be trusted.. | 0.000 | 0.000 | 1.000 | "*Ndị ofe mmanụ* (slur for Yoruba people) can never be trusted"; becomes the T9 alert |
| 12 | 2 days ago | `test_igbo_00246` | o tata ka ima? rt"@username : ndi ofe mmanu bu ndi nzuzu." | 0.000 | 0.000 | 1.000 | Quotes "*ndị ofe mmanụ* are fools" |
| 13 | 6 days ago | `test_igbo_00601` | @username otua ka ndụ ndị ofe mmanụ nile dị! okomoko mere ha ncha! | 0.000 | 0.000 | 1.000 | Generalises about all *ndị ofe mmanụ* |
| 14 | 9 days ago | `test_igbo_00411` | @username ✍️imana iru dị mma, adịro mma ịtụ mbọ. maka ndị ugwu na ndị ofe mmanụ egbu go anyị na obodo a, mana chukwu ga e chi ha unyi na anya nke ikpe azụ a | 0.000 | 0.000 | 1.000 | Says *ndị ugwu* and *ndị ofe mmanụ* killed "us" and calls God's judgement on them |
| 15 | 23 days ago | `test_igbo_00679` | @username bia femi imakwa ihe oo?ezigbo isi adiro gi mma. maka na mu bu onye ala ga emem kam mara asusu nile okwaya? isi na ima ihe kowa ihe a ndeturu. ndi ofe mmanu unu ezuzu gbugo onwu unu. tufiaa | 0.000 | 0.000 | 1.000 | Insults *ndị ofe mmanụ* as a group |


### 4.2 Yoruba

**Normal**

| # | Posted | Dataset ID | Text (verbatim) | P(Normal) | P(Abuse) | P(Hate) | Why it fits (my reading) |
|---|---|---|---|---|---|---|---|
| 16 | 1 day ago | `test_yoruba_00061` | mo ki gbogbo omo kaaro ojiire patapata nile loko ati leyin odi a dara fun gbogbo wa o amin | 0.980 | 0.020 | 0.000 | Greets all Yoruba people at home and abroad |
| 17 | 4 days ago | `test_yoruba_00181` | àwa ọmọ mùsùlùmí òdodo ẹ kú ọdún un ẹ̀yí ò ní jẹ́ àṣemọ a óò rí míì lọ́lá ọlọ́run ọba | 0.986 | 0.014 | 0.000 | Festival greeting to Muslims |
| 18 | 9 days ago | `test_yoruba_00325` | ẹ̀wà àti gaàrí ìjẹ̀bú tó kan gógó | 0.981 | 0.018 | 0.001 | Praises beans and Ijebu garri |
| 19 | 13 days ago | `test_yoruba_00805` | ẹranko wo ni à ń pè ní olólà ijù kíní fà á tí a fi pè é ní olólà erin tori oun lo tobi ju nigbo erin kọ́ | 0.980 | 0.020 | 0.000 | Riddle: which animal is called king of the forest |
| 20 | 27 days ago | `test_yoruba_00152` | ẹ̀yín ará ẹ jẹ́ kí elédùà jẹ́ olùrànlọ́wọ́ wa ní gbogbo ìgbà ẹ̀dá èèyàn á máa dójú tini nígbà míràn | 0.982 | 0.018 | 0.000 | Asks God to be our helper |

**Abuse**

| # | Posted | Dataset ID | Text (verbatim) | P(Normal) | P(Abuse) | P(Hate) | Why it fits (my reading) |
|---|---|---|---|---|---|---|---|
| 21 | 3 h ago | `test_yoruba_00427` | "@username oloriburuku ni gbogbo iran e.  ofo loma se.  omoburuku osi." | 0.001 | 0.998 | 0.000 | Curses the person's lineage (*oloriburuku*) |
| 22 | 4 days ago | `test_yoruba_00409` | "@username ori e buru bi eegun to nle weyrey, omo ale jatijati!" | 0.001 | 0.998 | 0.000 | Personal insults (*weyrey*, *ọmọ àlè jatijati*) |
| 23 | 9 days ago | `test_yoruba_00637` | "@username oloriburuku! iya ti ba e mule ni egbe isu" | 0.001 | 0.997 | 0.001 | Personal insult (*oloriburuku*) |
| 24 | 9 days ago | `test_yoruba_00584` | "@username were ni ẹ, ẹyin ọmọ jatijati wọn wọn yìí. ó dá bí ẹni pé orí àwọn òbí ẹ tíì dàrú nílé." | 0.002 | 0.998 | 0.000 | Calls the person mad (*were*) and insults their parents |
| 25 | 18 days ago | `test_yoruba_00668` | "@username aye e ma baje ni, oloriburuku omo ofo" | 0.002 | 0.998 | 0.001 | Personal insult and curse (*oloriburuku*, *ọmọ òfò*) |

**Hate**

| # | Posted | Dataset ID | Text (verbatim) | P(Normal) | P(Abuse) | P(Hate) | Why it fits (my reading) |
|---|---|---|---|---|---|---|---|
| 26 | 25 min ago | `dev_yoruba_00581` | Oloriburuku Omo IPOB. Go back to your land. | 0.000 | 0.000 | 1.000 | Tells an Igbo (IPOB) person to "go back to your land"; becomes the T9 alert |
| 27 | 2 days ago | `test_yoruba_00628` | yunfa ló gba àwọn ọ̀darànmọràn fúlàní lálejò lókè ọya àfọ̀njá ló pè wọ́n wá sí ilẹ̀ káàárọ̀oòjíire àm | 0.000 | 0.000 | 1.000 | Calls Fulani people criminals (*ọ̀darànmọràn fúlàní*); the dataset text stops mid-word ("àm") |
| 28 | 6 days ago | `test_yoruba_00226` | "radarada! so, you want to be terrorising me in my state, ori ẹyin fúlàní yìí má ti dàrú o ##url | 0.000 | 0.001 | 0.999 | Insults Fulani people as a group |
| 29 | 9 days ago | `test_yoruba_00497` | "@username omo ale yoruba ni e. who is the oba of lagos?   ##url | 0.001 | 0.000 | 0.999 | Ethnic insult (*ọmọ àlè yoruba*) |
| 30 | 23 days ago | `test_yoruba_00042` | Werey Omo igbo | 0.000 | 0.001 | 0.998 | Ethnic slur against Igbo people; only 3 words |

### 4.3 Why one Yoruba Hate post is from the dev split

Only 4 test posts gold-labelled Yoruba Hate are both predicted correctly by the deployed model and read as hate (sections 5 and 6 explain the other 4). `dev_yoruba_00581` is the clearest Yoruba Hate post in the dev split, and the deployed model labels it Hate with P = 1.000. The model was not trained on the dev split; it was used only to choose the checkpoint.

## 5. What I left out, and why

| Dataset ID | Gold | Model | Text (verbatim) | Why it is left out |
|---|---|---|---|---|
| `test_yoruba_00263` | Hate | Hate | "man city ti lule o, be like liverpool lokan bayi o" | Football banter ("man city ti lule o") |
| `test_yoruba_00106` | Hate | Hate | "@username imole ati egbe pdp ma lule ni saturday" | Says a party will lose on Saturday (*lule*) |
| `test_yoruba_00707` | Hate | Hate | orúkọ àwọn mẹ́ẹ̀dógún tó jẹ́ ìmàle ńnú ọmọbìnrin \| | Reads like a neutral list of names |
| `test_igbo_00400` | Hate | Hate | @username this comment is uncalled for. stop preaching such stereotypes.  ndi ugwu na ndi ofe mmanu na ako, e soru fa na ako udi ajambele a ? | Counter-speech: "stop preaching such stereotypes" |
| `test_igbo_00583` | Hate | Hate | tufac na asu asusu igbo. d'banj n'asu igbo. mi n'asu igbo... umunna asusu igbo amaka. ndi ugwu,  ndi ofe mmanu, ndi mba mmiri... igbo kwenu! | Celebrates the Igbo language and lists groups |
| `test_igbo_00344` | Hate | Hate | @username you're here calling him all sorts of things; ndi ugwu awusa na ofe mmanu ana-akpo ndi igbo chineke kesiri ike terrorists. aru! imagine being compared with boko haram. you guys need to fix up, and immediately too. | Mostly English; objects to Igbo people being called terrorists |
| `dev_yoruba_00692` | Hate | Normal | "niwaju tani! ati tani!! pelu tani!!!  omo ale anambra kan o le waa kan iran awon baba temi labuku.  omo oba ni mi, mo se kaabiesi f'ori ade.  oba lamidi adeyemi atanda, orun ree ooo. ##url | The deployed model labels it Normal, not Hate |
| `dev_yoruba_00264` | Hate | Normal | be eyankan lobi eranko yi se awon hausa ati fulani nikan lodibo fun ni odun ni ti aba se ofintoto ko seni to ran were nise o | The deployed model labels it Normal, not Hate |
| `dev_yoruba_00350` | Hate | Abuse | "@username so you want your own website to remain static abi?? ori e to dàrú iwo ọmọ ale jatijati yi. ọmọ abi pàá bẹ ti n fi owo osi juwe ile baba. eru hausa ati igbo l'ose ku. iwo ọmọ irandiran. aye é ti run jege." | The deployed model labels it Abuse, not Hate |
| `dev_yoruba_00069` | Hate | Abuse | "you are really mad  and your attitude towards the word 'enervating' is getting particularly irritatingly enervating. oloshi  omo ibo oshi🙄🙄🙄 ##url | The deployed model labels it Abuse, not Hate |
| `test_igbo_00644` | Normal | Normal | @username mgbada chijioke anyigor 0759446702 access bank  am from ebonyi state | Contains a bank account number (personal data); gold Normal |

In addition, every post from the second-wave Facebook (MCL) data is left out (see section 2, point 6).

`test_yoruba_00263` and `test_yoruba_00106` are predicted Hate with P ≈ 1.000, although neither reads as hate. Both contain *lule* ("fall", "lose"). That may be worth a sentence in the error analysis.

## 6. Spares (already checked on the deployed model; use one if you reject a post)

| Dataset ID | Class | Text (verbatim) | P(Normal) | P(Abuse) | P(Hate) | Note (my reading) |
|---|---|---|---|---|---|---|
| `test_igbo_00081` | Normal | #igboproverbfriday @username nkata ga-ekpudo onye aghụghọ.   ọchụ nwa ọkụkọ nwe ada.   ọkụkọ bere n'ngige, ọkụkọ na egwu ngige na egwu. | 0.995 | 0.005 | 0.000 | Igbo proverbs (#igboproverbfriday) |
| `test_igbo_00330` | Normal | #thebible: gee nna nke mụrụ gị ntị, eledakwala nne gị anya naanị n’ihi na o mewo agadi- ilu 23:22.  #god #thedanieldallas #twitter | 0.993 | 0.007 | 0.000 | Bible verse (Proverbs 23:22) |
| `test_igbo_00115` | Abuse | @username with due respect sir, kitikpa gbagbuo gị | 0.003 | 0.996 | 0.001 | "With due respect sir" plus a curse (*kitikpa gbagbuo gị*) |
| `test_igbo_00023` | Abuse | @username onye iberibe afo sa gi dia | 0.003 | 0.996 | 0.001 | Personal insult (*onye iberibe*) |
| `test_igbo_00464` | Hate | @username nne, o bu onye ara, enweghi m oge ka m gwa gi ife. ara ga gba ndi ara. ndi nzuzu ha nwe ishi ako n'uche.ofe mmanu bu ofe mmanu.ogbanje kaobu | 0.000 | 0.000 | 1.000 | Insults, ending "*ofe mmanu bu ofe mmanu*" |
| `test_igbo_00392` | Hate | @username ndi ofe mmanu egbugo mmadu here. | 0.000 | 0.000 | 1.000 | Accuses *ndị ofe mmanụ* of killing someone |
| `test_yoruba_00280` | Normal | ojúmọ́ rere mọ́ wa lónìí oṣù ire ajé oníso ibòoji mẹ́rìndínlógún á wá wa wálé lọ́láa elédùà ẹ pé á á ṣẹ | 0.975 | 0.025 | 0.000 | Morning greeting and prayer |
| `test_yoruba_00237` | Normal | àwọn ọ̀dọ́ péjọ̀ sí fún àpérò ọlọ́dọọdún ọ̀dọ́ ilẹ̀ afrika àjọ ò ní tú o | 0.978 | 0.022 | 0.000 | News: annual African youth meeting |
| `test_yoruba_00651` | Abuse | "@username awòn baba baba ę ni werey àlàsò🤣🤣. òmo radarada!" | 0.002 | 0.998 | 0.001 | Insults the person's forefathers (*werey*) |
| `test_yoruba_00228` | Abuse | "@username oloriburuku ni e, omo ale radarada" | 0.002 | 0.997 | 0.001 | Personal insult (*oloriburuku*, *ọmọ àlè*) |
| `test_yoruba_00376` | Hate | "ko si omo kidi ni apc ni ?....awon omo buruku, oniranu, alatenuje alainironu nah e plenty for southwest wing of apc. ##url | 0.002 | 0.036 | 0.962 | Political insults against APC members; closer to Abuse on my reading |
| `dev_yoruba_00247` | Hate | Your mission is to establish an  IPOB base in Yoruba land. Only an omo ale yoruba will vote for you. | 0.000 | 0.000 | 1.000 | Mostly English; "only an *omo ale yoruba* will vote for you" |

## 7. Effects on the rest of the study

- **The decision task must exclude these 30 posts.** The plan says its 8 posts per language come from the test split and are not used in the usability tasks.
- **Yoruba Hate is scarce.** The deployed model gets only 8 of the 25 Yoruba Hate test posts right. This seed uses 4 of them (`00628`, `00226`, `00497`, `00042`), which leaves few correct Yoruba Hate posts for the decision task.
- **Igbo Hate depends on one slur.** Every Igbo Hate post the model gets right uses *ndị ofe mmanụ*. In T6 and T7, the explanations and the "term that raises toxicity most" will very likely point at it.

## 8. How the seed will run, after your approval

1. Back up the VM's database.
2. A new script, `backend_api_server/scripts/seed_study_org.py`, will:
   - create the organization and the participant account (the password is asked twice, hidden);
   - classify the 30 texts again with the deployed models, and **stop without writing anything** if any label differs from this file;
   - insert the 30 posts with the timestamps from section 3.
3. `--reset --language igbo|yoruba` puts the organization back to the seeded state before each participant. It deletes the organization's posts, flags, relabels and alerts, then seeds again with fresh timestamps, with the alert post in the session's language. **Run it within one hour before each session**, so that T2 and T9 work.
4. Pre-compute the explanations for all 30 posts (plan M3). The VM has no GPU, so new explanations can pass the dashboard's 25 s limit. The cache is keyed on the text, so it survives every `--reset`.

## 9. Questions for you

1. **Organization name:** is "HateGuard Study Forum" fine?
2. **Participant login:** should all participants share one account (`participant@hateguard.test`, reset before each session), or should each get their own (P01–P10) in this one organization? With one organization, flags and relabels from one participant stay visible to the next unless you run `--reset`.
3. **Timestamps:** is the pattern in section 3 fine for T2, T3 and T9?
4. **Posts:** strike any post you reject, and I'll replace it from section 6.
