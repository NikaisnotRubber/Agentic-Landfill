# 撠??脣漲??颲衣蜇銵?


> **?敺??*嚗?026-06-29嚗?*VM max online users schema**嚗?> **撟喳??嚗?* `feat/platform-mapping-db-export`嚗 `master`嚗? 
> **撌亙 Phase 4 ?嚗?* `feat/phase-4-ops`嚗銝西?嚗? 
> **?桀?隢?賂?** [`docs/superpowers/plans/2026-06-03-platform-track-b-plan.md`](superpowers/plans/2026-06-03-platform-track-b-plan.md)  
> **?閬?嚗?* [`docs/superpowers/plans/2026-06-02-branch-workflow.md`](superpowers/plans/2026-06-02-branch-workflow.md)  
> **蝬剛風?孵?**嚗??寧??[`AGENTS.md`](../AGENTS.md)??


## ???靘?


| 璅? | ?儔 |

|------|------|

| ??| 撌脣????冽 repo ?舐 |

| ? | Phase 1 撌脖漱隞? Phase 2 敺?嚗平????甈?嚗?|

| 漎?| Phase 2+ ?像?啁? |

| ? | ?瑟?嚗像?啣? |



---



## Phase 1 ??撌脩Ⅱ隤???2026-06-02嚗?


銝餌?嚗?*?巨 ??DDP ?蕪 ??AD enrich ??Processed View ??Excel ?臬嚗蝷?嚗?*??撘? 2026-05 superpowers spec 銝?湛?**?⊿?????Phase 1**??


| ? | ???|

|------|------|

| Helpdesk ?餃 / session?ive / Sample?DP ?蕪 | ??|

| Fetch + Enrich?nrich Current?DAP enrich | ??|

| Processed DDP View?撌亙 tracker?B/VM ?膩閫?? | ??|

| First/Last Name?anager sAMAccountName | ??|

| Excel 銝?sheet??0 甈見撘?????xport UI/CLI | ??|

| Zentera CSV ?批?蝝Ｗ?嚗M ??嚗?| ??撖虫?撌脫?嚗?*璆剖??? Phase 2A** |



**Phase 1 畾?嚗??餃? Phase 2嚗???Phase 3+嚗?** AD 鈭Ⅳ?issing-ad ???I?harePoint??蝔像??DB??


---



## ?桀??脰?銝哨?Track B嚗?撠?DB + ?臬憟?嚗?
| ?挾 | ?批捆 | ?辣 |
|------|------|------|
| **B0?6** | `mapping_row`??箏?蝝ipeline??箝PI?極?桀?銝 | [`platform-track-b-plan`](superpowers/plans/2026-06-03-platform-track-b-plan.md) |
| **Spec** | DB ??Excel ???臬蝝啁?摨血?朣?| [`platform-mapping-db-export`](superpowers/specs/2026-06-03-platform-mapping-db-export.md) |

---

## Phase 4嚗??甈∴??臭蒂銵?



| ?挾 | ?批捆 | ?辣 |

|------|------|------|

| **4** | SharePoint??蝔workflow:ddp` ?辣 | ? [`phase-4-todo`](superpowers/plans/2026-06-02-phase-4-todo.md) |

| **2A??** | VM嚗澈??Excel嚗I嚗D | ??撌脣?雿?`master` |

閰唾? [phase-2-todo](superpowers/plans/2026-06-02-phase-2-todo.md)?phase-3-todo](superpowers/plans/2026-06-02-phase-3-todo.md)??


?瘙?ID 撠嚗`specs/2026-06-02-helpdesk-backlog.md`](superpowers/specs/2026-06-02-helpdesk-backlog.md) 禮2.1??.2??


---



## 撱嗅???Phase 3+嚗?閬?



| ?憛?| 隞?”??| ???|

|------|--------|------|

| AD ?釭 | 鈭Ⅳ?issing-ad vs mail | ? ??Phase 3 |

| Excel 撱嗡撓 | NAS?emplate嚗靘??征嚗?| 漎???2B 閮餅???Phase 3 |

| 撌亦? | CI?ite 皜祈岫?暹? | 漎???Phase 3 |

| ?? | SharePoint??蝔?| ? ??Phase 4嚗脰?銝哨? |

| 撟喳 | DB + ?臬憟?嚗?602嚗?| ? spec/plan ??**Track B ?銝?* |



---



## 餈凋誨蝝??


| ?交? | 餈凋誨 | 鈭支? |

|------|------|------|

| **2026-06-29** | **VM max online users schema** | `vm_machines.max_online_users`???DB migration?M Master preview `maxOnlineUsers`?chema regression test |

| 2026-05-22嚚?8 | Ticket Preview + AD Enrich | ?巨?DAP?I |

| 2026-05-29 | Processed DDP View | 閫???racker?rocessed ?? |

| 2026-05-30嚚?1 | Zentera VM + 頨怠??港蔥 | manager ??VM?arseAdName |

| 2026-06-02 | Excel ?臬嚗蝷? | `server/excel/*`?I?LI |

| **2026-06-02** | **Phase 1 蝯? + Phase 2 閮?** | backlog?oadmap??*phase-2-todo** |
| **2026-06-02** | **Phase 2 ?** | `feat/phase-2-vm-identity-excel`?branch-workflow.md` |
| **2026-06-02** | **Phase 2A** | VM/頨怠?/?啣虜?abnormalFlags.ts`?phase2aIdentityAndAbnormal.test.ts` |
| **2026-06-02** | **Phase 2B** | Zentera Role/Application/User Roles?phase2bZenteraExport.test.ts` |
| **2026-06-02** | **Phase 3** | CI?elpdeskVitePlugin?ojibake?ffective AD account?workflow:ddp` |
| **2026-06-02** | **?蔥 master** | Phase 2A/2B/3 ??`ec626d9`嚗?蝡?`origin` bundle 撌脫??|
| **2026-06-02** | **Phase 4 ??** | `feat/phase-4-ops`?harePoint CLI??蝔?`.ps1` |
| **2026-06-03** | **Track B 閬** | `mapping-export-schema.json`?latform spec?0?6 plan |
| **2026-06-15** | **Helpdesk 銵冽 TanStack ??* | `@tanstack/vue-table`?aw/Processed table column definitions?????雿???|
| **2026-06-17** | **Helpdesk ?餃 selector ?啣??詨捆** | Windows/WSL selector profile?indows DOM Playwright ?Ｘ葫???helper 皜祈岫 |
| **2026-06-17** | **AD/LDAP ?迂 parser ??VM Master 甈?閬?** | `normalizeAdEntry` ?梢?LDAP 閫?Ⅳ?CHN_NAME` 銝剜????REPORT_TO` ?望?????|
| **2026-06-17** | **Helpdesk VM sync mock test** | ?啣? `CHUNKAI.LIU` mock regression test嚗蒂閮? TDD 閫撖??[`2026-06-17-helpdesk-vm-sync-chunkai-liu-test.md`](superpowers/reports/2026-06-17-helpdesk-vm-sync-chunkai-liu-test.md) |
| **2026-06-18** | **Helpdesk VM sync live AD test** | 靽格迤 `SUNGCHAO.SC.YU` 皜祈岫?寧? AD lookup ?乩蜓蝞∴?`ALEX.MX.CHEN`嚗?銝行??TDD 閫撖??[`2026-06-18-helpdesk-vm-sync-sungchao-sc-yu-test.md`](superpowers/reports/2026-06-18-helpdesk-vm-sync-sungchao-sc-yu-test.md) |
| **2026-06-18** | **Helpdesk VM sync lifecycle test** | ?啣? YAML-driven lifecycle 皜祈岫嚗??蜓蝞∪?雿?甈?DB 撖怠???冽?湔??VM assignment replace |



---



## ?辣蝝Ｗ?



| ?辣 | ?券?|

|------|------|

| [**phase-2-todo**嚗?貊嚗(superpowers/plans/2026-06-02-phase-2-todo.md) | Phase 2A/2B 隞餃?皜 |
| [branch-workflow](superpowers/plans/2026-06-02-branch-workflow.md) | ???雿萎蜓蝺???|

| [roadmap](superpowers/plans/2026-06-02-helpdesk-development-roadmap.md) | ?券?畾萇蜇閬?|

| [backlog](superpowers/specs/2026-06-02-helpdesk-backlog.md) | REQ-* ID |

| [vm-lookup spec ?阮](superpowers/specs/2026-06-02-vm-lookup-and-identity.md) | 2A 瘙箇? D1/D2 |

| [helpdesk-workflow.md](helpdesk-workflow.md) | ??隤芣? |
| [**platform-track-b-plan**](superpowers/plans/2026-06-03-platform-track-b-plan.md) | Track B ?暸皜 |
| [platform-mapping spec](superpowers/specs/2026-06-03-platform-mapping-db-export.md) | ?? DB + ?臬憟? |
| [mapping-export-schema.json](superpowers/fixtures/mapping-export-schema.json) | 甈?憟?嚗??典霈嚗?|
# Helpdesk / VM Master Progress

> **最後更新**: 2026-06-30
> **目前分支**: `feat/vm-master-cqrs-manual-edit`
> **目前重點**: VM Master Preview manual edit CQRS command

## 餈凋誨蝝??
| ?交? | 餈凋誨 | Deliverables |
|------|------|--------------|
| 2026-06-29 | VM max online users schema | ??Added `vm_machines.max_online_users`; ??migrates existing VM Master DBs; ??exposes `maxOnlineUsers` in VM Master preview rows; ??covered with `tests/vmMasterSchema.test.ts`. |
| 2026-06-29 | PoC architecture consolidation | ??Added shared CSV IO via `csv-parse`; ??restored `exceljs` as an explicit dependency; ??moved role inference into `platform/mapping`; ??consolidated client JSON requests and VM Master async state; ??removed obsolete tests for deleted legacy helper modules; ??fixed DDP enriched AD processing and platform ticket sync summary; ??`pnpm build` and `pnpm test` pass. |
| 2026-06-29 | LDAP Big5 parser regression fix | ??Decoded LDAP `cn` buffers with Big5/CP950 fallback; ??shared AD token cleanup across display names, requesters, and VM ticket descriptions; ??covered `UNO.CHEN ?單?, `UNO.CHEN2 ?單?, and `??鞊注 regression cases. |
| 2026-06-29 | Windows integrated LDAP Unicode hardening | ??Changed PowerShell integrated lookup payload to UTF-16LE Base64 JSON to avoid CP950 stdout mojibake; ??added parser regression coverage for `UNO.CHEN ?單? and manager DN Chinese names. |

## 撱箄降銝?甇?
| ?芸?蝝?| 撱箄降 |
|--------|------|
| ✅ | Continue feature work from the consolidated VM Master + platform mapping surface. |
| 🟡 | Review VM Master manual edit workflow with operators before adding row create/delete or MQ publishing. |
| ? | If Excel/SharePoint legacy workflows are needed again, reintroduce them as platform-level public modules with tests, not as scattered `server/excel` / `server/sharepoint` helpers. |
