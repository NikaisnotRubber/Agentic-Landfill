# 專案進度與待辦總表



> **最後更新**：2026-06-02（**Phase 3 已合併 `master`**；**Phase 4 開發中**）  
> **開發分支：** `feat/phase-4-ops`（自 `master` @ `ec626d9`）  
> **目前請勾選：** [`docs/superpowers/plans/2026-06-02-phase-4-todo.md`](superpowers/plans/2026-06-02-phase-4-todo.md)  
> **分支規則：** [`docs/superpowers/plans/2026-06-02-branch-workflow.md`](superpowers/plans/2026-06-02-branch-workflow.md)  
> **維護方式**：見根目錄 [`AGENTS.md`](../AGENTS.md)。



## 狀態圖例



| 標記 | 意義 |

|------|------|

| ✅ | 已完成且在本 repo 可用 |

| 🟡 | Phase 1 已交付但 Phase 2 待補（業務規則／欄位） |

| ⬜ | Phase 2+ 或平台線 |

| 🔮 | 長期／平台化 |



---



## Phase 1 — 已確認完成（2026-06-02）



主線：**取票 → DDP 過濾 → AD enrich → Processed View → Excel 匯出（基礎版）**。程式與 2026-05 superpowers spec 一致，**無需重開發 Phase 1**。



| 項目 | 狀態 |

|------|------|

| Helpdesk 登入 / session、Live / Sample、DDP 過濾 | ✅ |

| Fetch + Enrich、Enrich Current、LDAP enrich | ✅ |

| Processed DDP View、新工單 tracker、NB/VM 描述解析 | ✅ |

| First/Last Name、Manager sAMAccountName | ✅ |

| Excel 三 sheet、20 欄、樣式、超連結、Export UI/CLI | ✅ |

| Zentera CSV 內嵌索引（VM 初版） | ✅ 實作已有；**業務鏈待 Phase 2A** |



**Phase 1 殘留（不阻塞 Phase 2，列入 Phase 3+）：** AD 亂碼、missing-ad 旗標、CI、SharePoint、排程、平台 DB。



---



## 目前進行中：Phase 4（營運批次）



| 階段 | 內容 | 文件 |

|------|------|------|

| **4** | SharePoint、排程、`workflow:ddp` 文件 | 🟡 [`phase-4-todo`](superpowers/plans/2026-06-02-phase-4-todo.md) |

| **2A–3** | VM／身分／Excel／CI／AD | ✅ 已合併 `master` |

詳見 [phase-2-todo](superpowers/plans/2026-06-02-phase-2-todo.md)、[phase-3-todo](superpowers/plans/2026-06-02-phase-3-todo.md)。



需求 ID 對照：[`specs/2026-06-02-helpdesk-backlog.md`](superpowers/specs/2026-06-02-helpdesk-backlog.md) §2.1–2.2。



---



## 延後至 Phase 3+（摘要）



| 區塊 | 代表項 | 狀態 |

|------|--------|------|

| AD 品質 | 亂碼、missing-ad vs mail | 🟡 → Phase 3 |

| Excel 延伸 | NAS、Template（無來源則空） | ⬜ → 2B 註明或 Phase 3 |

| 工程 | CI、vite 測試逾時 | ⬜ → Phase 3 |

| 營運 | SharePoint、排程 | 🟡 → Phase 4（進行中） |

| 平台 | DB 內容總表（0602） | ⬜ → Track B |



---



## 迭代紀錄



| 日期 | 迭代 | 交付 |

|------|------|------|

| 2026-05-22～28 | Ticket Preview + AD Enrich | 取票、LDAP、UI |

| 2026-05-29 | Processed DDP View | 解析、tracker、Processed 切換 |

| 2026-05-30～31 | Zentera VM + 身分整併 | manager 查 VM、parseAdName |

| 2026-06-02 | Excel 匯出（基礎） | `server/excel/*`、UI、CLI |

| **2026-06-02** | **Phase 1 結案 + Phase 2 計劃** | backlog、roadmap、**phase-2-todo** |
| **2026-06-02** | **Phase 2 分支** | `feat/phase-2-vm-identity-excel`、`branch-workflow.md` |
| **2026-06-02** | **Phase 2A** | VM/身分/異常、`abnormalFlags.ts`、`phase2aIdentityAndAbnormal.test.ts` |
| **2026-06-02** | **Phase 2B** | Zentera Role/Application/User Roles、`phase2bZenteraExport.test.ts` |
| **2026-06-02** | **Phase 3** | CI、helpdeskVitePlugin、mojibake、effective AD account、`workflow:ddp` |
| **2026-06-02** | **合併 master** | Phase 2A/2B/3 → `ec626d9`；遠端 `origin` bundle 已更新 |
| **2026-06-02** | **Phase 4 啟動** | `feat/phase-4-ops`、SharePoint CLI、排程 `.ps1` |



---



## 文件索引



| 文件 | 用途 |

|------|------|

| [**phase-2-todo**（勾選用）](superpowers/plans/2026-06-02-phase-2-todo.md) | Phase 2A/2B 任務清單 |
| [branch-workflow](superpowers/plans/2026-06-02-branch-workflow.md) | 分支與合併主線規則 |

| [roadmap](superpowers/plans/2026-06-02-helpdesk-development-roadmap.md) | 全階段總覽 |

| [backlog](superpowers/specs/2026-06-02-helpdesk-backlog.md) | REQ-* ID |

| [vm-lookup spec 草稿](superpowers/specs/2026-06-02-vm-lookup-and-identity.md) | 2A 決策 D1/D2 |

| [helpdesk-workflow.md](helpdesk-workflow.md) | 操作說明 |


