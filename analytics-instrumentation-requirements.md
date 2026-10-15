

## 9. Spreadsheet 平台行为专项口径

用户在 Spreadsheet 上看到的平台行为需要拆成三种，不能把它们混成一个“平台点击数”：

| 行为 | 事件 | 含义 |
|---|---|---|
| 用户主动筛选平台 | `spreadsheet_platform_select` | 用户通过 Platform 下拉框主动选择某个平台 |
| 系统默认选择平台 | `spreadsheet_platform_auto_select` | 用户展开商品购买选项后，系统根据商品的 primary 平台自动选中的平台 |
| 最终点击平台 | `affiliate_click` | 用户实际点击了 Spreadsheet 内的外部平台入口 |

### 9.1 平台自动选择逻辑

- 如果用户没有选择平台，系统优先选择商品数据中的 `primary` 平台，记录为 `selection_mode=default_primary`。
- 如果用户先通过平台筛选器选择了某个平台，展开商品后系统选择该平台，记录为 `selection_mode=filter_selected`。
- 如果商品没有 primary 平台，则使用平台列表中的第一个平台，记录为 `selection_mode=fallback_first`。
- 用户真正点击平台链接时，`affiliate_click` 增加 `page_type=spreadsheet` 和 `surface=spreadsheet_inline`。

### 9.2 后台平台报表

`/admin/analytics` 新增 Spreadsheet 平台选择模块，每个平台展示：

- 主动筛选次数
- 系统默认选择次数
- 最终外链点击次数
- 相关匿名访客数

建议重点关注：

```text
平台最终点击率
= 该平台 affiliate_click 用户数
/ 该平台被自动选择或被主动筛选的用户数
```

```text
平台偏好率
= 该平台自动选择次数
/ 所有 Spreadsheet 平台自动选择次数
```

```text
主动筛选后点击率
= 主动筛选某平台后点击该平台的用户数
/ 主动筛选该平台的用户数
```

> 这些指标只描述 RIVORA 站内的选择和点击行为，不代表用户在第三方平台完成购买。
