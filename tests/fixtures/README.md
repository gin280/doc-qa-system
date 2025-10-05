# 测试Fixtures清单

本目录包含Story 2.3文档解析功能的测试文件。

## 状态: ⚠️ 待准备

根据QA评估(docs/qa/assessments/2.3-test-design-20250104.md),需要准备以下测试文件:

## 必需文件 (P0优先级)

### PDF测试集
```
tests/fixtures/pdf/
  ├── normal-adobe.pdf          # Adobe Acrobat生成，5页，1MB
  ├── normal-word.pdf           # Word导出，10页，2MB
  ├── normal-libreoffice.pdf    # LibreOffice生成，8页，1.5MB
  ├── chinese.pdf               # 纯中文，5页，1MB
  ├── encrypted.pdf             # 加密PDF（测试ENCRYPTION_ERROR）
  ├── corrupted.pdf             # 损坏PDF（测试PARSE_ERROR）
  ├── 1mb.pdf                   # 性能测试（<5秒）
  └── 10mb.pdf                  # 性能测试（<30秒）
```

### Word测试集
```
tests/fixtures/docx/
  ├── normal.docx               # 正常Word文档，5页
  ├── chinese.docx              # 纯中文Word
  ├── multi-paragraph.docx      # 多段落（测试段落结构）
  ├── corrupted.docx            # 损坏文档
  └── old-format.doc            # 旧格式（测试错误提示）
```

### 文本测试集
```
tests/fixtures/text/
  ├── utf8.txt                  # UTF-8编码
  ├── gbk.txt                   # GBK编码（中文）
  ├── sample.md                 # Markdown文档
  └── complex.md                # 复杂Markdown（代码块、表格）
```

## 扩展文件 (P1/P2优先级)

### 额外PDF测试
```
tests/fixtures/pdf/
  ├── normal-wps.pdf            # WPS导出
  ├── normal-google.pdf         # Google Docs导出
  ├── table-heavy.pdf           # 表格密集（10+表格）
  ├── formula.pdf               # 包含数学公式
  ├── scanned.pdf               # 扫描版（仅图片）
  ├── mixed-lang.pdf            # 中英混合
  ├── multi-column.pdf          # 多列布局
  ├── image-heavy.pdf           # 图片密集
  └── 50mb.pdf                  # 内存测试
```

## 测试文件元数据

每个测试文件应包含以下信息(记录在此README):

### normal-adobe.pdf
- **来源**: Adobe Acrobat DC生成
- **内容**: 5页技术文档(中英混合)
- **预期结果**: 成功解析,totalPages=5
- **用途**: 测试基础PDF解析功能

### encrypted.pdf
- **来源**: Adobe Acrobat加密
- **密码**: test123
- **预期结果**: 抛出ENCRYPTION_ERROR
- **用途**: 测试加密PDF错误处理

### corrupted.pdf
- **来源**: 手动损坏的PDF文件
- **预期结果**: 抛出PARSE_ERROR
- **用途**: 测试损坏文件处理

(TODO: 完善所有测试文件的元数据)

## 准备方法

1. **生成测试PDF**:
   - 使用不同工具创建相同内容的PDF
   - 确保包含中文和英文内容
   - 控制文件大小在指定范围内

2. **创建加密PDF**:
   ```bash
   # 使用qpdf加密PDF
   qpdf --encrypt user-password owner-password 128 -- input.pdf encrypted.pdf
   ```

3. **创建损坏文件**:
   ```bash
   # 截断PDF文件
   head -c 1000 normal.pdf > corrupted.pdf
   ```

4. **Git LFS管理**:
   ```bash
   # 对于大文件(>10MB),使用Git LFS
   git lfs track "tests/fixtures/**/*.pdf"
   git lfs track "tests/fixtures/**/*.docx"
   ```

## 责任人

- **Dev团队**: 创建基础测试文件
- **QA团队**: 验证测试文件质量和完整性
- **协作**: 共同维护测试fixtures清单

## 下一步

1. [ ] 准备P0必需测试文件(8个PDF + 5个Word + 4个文本)
2. [ ] 验证所有测试文件可用性
3. [ ] 更新测试用例使用实际fixtures
4. [ ] 运行完整测试套件
5. [ ] 准备P1/P2扩展测试文件

## 参考文档

- QA测试设计: `docs/qa/assessments/2.3-test-design-20250104.md`
- QA风险评估: `docs/qa/assessments/2.3-risk-20250104.md`
- Story文件: `docs/stories/2.3-document-parsing.md`
