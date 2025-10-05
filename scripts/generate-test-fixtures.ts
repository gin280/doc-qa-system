/**
 * 自动生成测试fixtures
 * 
 * 运行: npx tsx scripts/generate-test-fixtures.ts
 */

import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import iconv from 'iconv-lite'

const FIXTURES_DIR = path.join(__dirname, '../tests/fixtures')

// 确保目录存在
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`✅ 创建目录: ${dir}`)
  }
}

// 生成PDF文件
async function generatePDF(filename: string, options: {
  pages: number
  content: string
  metadata?: {
    title?: string
    author?: string
    creator?: string
  }
}) {
  return new Promise<void>((resolve, reject) => {
    const filePath = path.join(FIXTURES_DIR, 'pdf', filename)
    
    const docOptions: any = {}
    if (options.metadata) {
      docOptions.info = {}
      if (options.metadata.title) docOptions.info.Title = options.metadata.title
      if (options.metadata.author) docOptions.info.Author = options.metadata.author
      if (options.metadata.creator) docOptions.info.Creator = options.metadata.creator
    }
    
    const doc = new PDFDocument(docOptions)
    
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)
    
    // 写入内容
    for (let i = 0; i < options.pages; i++) {
      if (i > 0) doc.addPage()
      
      doc.fontSize(16)
         .text(`第${i + 1}页 / Page ${i + 1}`, { align: 'center' })
         .moveDown()
      
      doc.fontSize(12)
         .text(options.content)
         .moveDown()
      
      doc.fontSize(10)
         .text(`这是第${i + 1}页的测试内容。This is test content for page ${i + 1}.`)
    }
    
    doc.end()
    
    stream.on('finish', () => {
      const stats = fs.statSync(filePath)
      console.log(`✅ 生成PDF: ${filename} (${(stats.size / 1024).toFixed(1)}KB, ${options.pages}页)`)
      resolve()
    })
    
    stream.on('error', reject)
  })
}

// 生成Word文档
async function generateWord(filename: string, options: {
  paragraphs: number
  content: string
}) {
  const paragraphsArray: Paragraph[] = []
  
  // 标题
  paragraphsArray.push(
    new Paragraph({
      children: [
        new TextRun({
          text: '测试Word文档 / Test Word Document',
          bold: true,
          size: 32
        })
      ]
    })
  )
  
  // 内容段落
  for (let i = 0; i < options.paragraphs; i++) {
    paragraphsArray.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${options.content}\n\n第${i + 1}段测试内容。This is paragraph ${i + 1} of test content.`
          })
        ]
      })
    )
  }
  
  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphsArray
    }]
  })
  
  const buffer = await Packer.toBuffer(doc)
  const filePath = path.join(FIXTURES_DIR, 'docx', filename)
  fs.writeFileSync(filePath, buffer)
  
  const stats = fs.statSync(filePath)
  console.log(`✅ 生成Word: ${filename} (${(stats.size / 1024).toFixed(1)}KB, ${options.paragraphs}段)`)
}

// 生成文本文件
function generateText(filename: string, content: string, encoding: string = 'utf-8') {
  const filePath = path.join(FIXTURES_DIR, 'text', filename)
  
  if (encoding === 'gbk') {
    // 使用iconv-lite处理GBK编码
    const buffer = iconv.encode(content, 'gbk')
    fs.writeFileSync(filePath, buffer)
  } else {
    fs.writeFileSync(filePath, content, encoding as BufferEncoding)
  }
  
  const stats = fs.statSync(filePath)
  console.log(`✅ 生成文本: ${filename} (${(stats.size / 1024).toFixed(1)}KB, ${encoding})`)
}

// 生成加密PDF（需要qpdf，如果不可用则跳过）
async function generateEncryptedPDF() {
  const { execSync } = require('child_process')
  
  try {
    // 先生成一个普通PDF
    const tempFile = path.join(FIXTURES_DIR, 'pdf', 'temp-for-encryption.pdf')
    await generatePDF('temp-for-encryption.pdf', {
      pages: 2,
      content: '这是一个将被加密的PDF文档。This PDF will be encrypted.'
    })
    
    // 使用qpdf加密
    const outputFile = path.join(FIXTURES_DIR, 'pdf', 'encrypted.pdf')
    execSync(`qpdf --encrypt test123 test123 128 -- "${tempFile}" "${outputFile}"`)
    
    // 删除临时文件
    fs.unlinkSync(tempFile)
    
    console.log('✅ 生成加密PDF: encrypted.pdf (密码: test123)')
  } catch (error) {
    console.log('⚠️  跳过加密PDF生成 (需要安装qpdf: brew install qpdf)')
    console.log('   手动创建: qpdf --encrypt test123 test123 128 -- input.pdf encrypted.pdf')
  }
}

// 生成损坏的PDF（截断文件）
async function generateCorruptedPDF() {
  // 先生成一个普通PDF
  await generatePDF('temp-for-corruption.pdf', {
    pages: 1,
    content: '这是一个将被损坏的PDF文档。'
  })
  
  const tempFile = path.join(FIXTURES_DIR, 'pdf', 'temp-for-corruption.pdf')
  const corruptedFile = path.join(FIXTURES_DIR, 'pdf', 'corrupted.pdf')
  
  // 读取文件并截断（只保留前1000字节）
  const buffer = fs.readFileSync(tempFile)
  fs.writeFileSync(corruptedFile, buffer.slice(0, 1000))
  
  // 删除临时文件
  fs.unlinkSync(tempFile)
  
  console.log('✅ 生成损坏PDF: corrupted.pdf (截断文件)')
}

// 生成损坏的Word文档
async function generateCorruptedWord() {
  // 先生成一个普通Word文档
  await generateWord('temp-for-corruption.docx', {
    paragraphs: 3,
    content: '这是一个将被损坏的Word文档。'
  })
  
  const tempFile = path.join(FIXTURES_DIR, 'docx', 'temp-for-corruption.docx')
  const corruptedFile = path.join(FIXTURES_DIR, 'docx', 'corrupted.docx')
  
  // 读取文件并截断
  const buffer = fs.readFileSync(tempFile)
  fs.writeFileSync(corruptedFile, buffer.slice(0, 500))
  
  // 删除临时文件
  fs.unlinkSync(tempFile)
  
  console.log('✅ 生成损坏Word: corrupted.docx (截断文件)')
}

// 生成大文件（用于性能测试）
async function generateLargeFiles() {
  console.log('\n📦 生成性能测试文件（可能需要几秒钟）...')
  
  // 1MB PDF (约10页)
  await generatePDF('1mb.pdf', {
    pages: 10,
    content: '这是性能测试PDF文档。此文档用于测试1MB文件解析时间应<5秒的要求。\n'.repeat(50)
  })
  
  // 10MB PDF (约100页)
  await generatePDF('10mb.pdf', {
    pages: 100,
    content: '这是大型性能测试PDF文档。此文档用于测试10MB文件解析时间应<30秒的要求。\n'.repeat(50)
  })
}

// 主函数
async function main() {
  console.log('🚀 开始生成测试fixtures...\n')
  
  // 创建目录结构
  ensureDir(path.join(FIXTURES_DIR, 'pdf'))
  ensureDir(path.join(FIXTURES_DIR, 'docx'))
  ensureDir(path.join(FIXTURES_DIR, 'text'))
  
  console.log('\n📄 生成PDF测试文件...')
  
  // 1. 正常PDF (模拟不同来源)
  await generatePDF('normal-adobe.pdf', {
    pages: 5,
    content: '这是模拟Adobe Acrobat生成的测试PDF文档。内容包含中英文混合文本，用于验证基础解析功能。\n\nThis is a test PDF document simulating Adobe Acrobat output. It contains mixed Chinese and English text to verify basic parsing functionality.',
    metadata: {
      title: 'Adobe Test Document',
      author: 'Test Author',
      creator: 'Adobe Acrobat DC'
    }
  })
  
  await generatePDF('normal-word.pdf', {
    pages: 10,
    content: '这是模拟Microsoft Word导出的测试PDF文档。包含较多页数用于测试分页处理。\n\nThis is a test PDF document simulating Microsoft Word export. Contains more pages to test pagination handling.',
    metadata: {
      title: 'Word Export Test',
      author: 'MS Word',
      creator: 'Microsoft Word'
    }
  })
  
  await generatePDF('normal-libreoffice.pdf', {
    pages: 8,
    content: '这是模拟LibreOffice生成的测试PDF文档。用于验证开源工具兼容性。\n\nThis is a test PDF document simulating LibreOffice output. Used to verify open-source tool compatibility.',
    metadata: {
      title: 'LibreOffice Test',
      author: 'LibreOffice',
      creator: 'LibreOffice 7.0'
    }
  })
  
  // 2. 中文PDF
  await generatePDF('chinese.pdf', {
    pages: 5,
    content: '这是一个纯中文测试PDF文档。用于验证中文字符提取和编码处理的正确性。包含常见的中文标点符号：，。！？；：\n\n测试段落一：中文解析测试内容。\n测试段落二：验证段落结构保留。\n测试段落三：检查字符统计准确性。'
  })
  
  // 3. 特殊PDF
  await generateCorruptedPDF()
  await generateEncryptedPDF()
  
  // 4. 性能测试PDF
  await generateLargeFiles()
  
  console.log('\n📝 生成Word测试文件...')
  
  // 1. 正常Word文档
  await generateWord('normal.docx', {
    paragraphs: 5,
    content: '这是正常的Word测试文档。包含多个段落用于验证基础解析功能和段落结构保留。\n\nThis is a normal Word test document with multiple paragraphs.'
  })
  
  // 2. 中文Word
  await generateWord('chinese.docx', {
    paragraphs: 8,
    content: '这是纯中文Word测试文档。\n\n第一段：测试中文字符提取。\n第二段：验证段落边界识别。\n第三段：检查中文标点符号处理：，。！？'
  })
  
  // 3. 多段落Word
  await generateWord('multi-paragraph.docx', {
    paragraphs: 15,
    content: '多段落测试文档。用于验证段落结构的正确保留和段落计数的准确性。'
  })
  
  // 4. 损坏Word
  await generateCorruptedWord()
  
  console.log('\n📋 生成文本测试文件...')
  
  // 1. UTF-8文本
  generateText('utf8.txt', `UTF-8编码测试文件

这是UTF-8编码的测试文本文件。
包含中文、English和标点符号。
用于验证UTF-8编码检测和文本提取。

测试内容：
- 行1：中文测试
- 行2：English test
- 行3：Mixed 混合内容`, 'utf-8')
  
  // 2. GBK编码文本
  generateText('gbk.txt', `GBK编码测试文件

这是GBK编码的中文测试文本。
用于验证字符编码自动检测功能。

测试内容：
第一行：中文字符测试
第二行：标点符号测试，。！？
第三行：数字测试123456`, 'gbk')
  
  // 3. Markdown文件
  generateText('sample.md', `# Markdown测试文档

## 简介

这是一个**Markdown**格式的测试文档，用于验证Markdown解析功能。

## 功能列表

- 列表项1
- 列表项2
- 列表项3

## 代码示例

\`\`\`typescript
function test() {
  console.log('Hello World')
}
\`\`\`

## 表格测试

| 列1 | 列2 | 列3 |
|-----|-----|-----|
| A   | B   | C   |

## 链接测试

[测试链接](https://example.com)

### 子标题

普通段落文本。**粗体**和*斜体*测试。

> 引用块测试

---

## 结束

测试完成。`, 'utf-8')
  
  // 4. 复杂Markdown
  generateText('complex.md', `# 复杂Markdown文档

## 综合测试

这个文档包含更复杂的Markdown元素。

### 代码块

\`\`\`javascript
// JavaScript代码
const data = {
  name: '测试',
  value: 123
}
\`\`\`

\`\`\`python
# Python代码
def hello():
    print("Hello, 世界")
\`\`\`

### 复杂表格

| 功能 | 状态 | 说明 |
|------|------|------|
| PDF解析 | ✅ | 支持多种格式 |
| Word解析 | ✅ | 支持.docx |
| 文本解析 | ✅ | 支持多种编码 |

### 嵌套列表

1. 第一项
   - 子项1
   - 子项2
     - 子子项
2. 第二项
   1. 有序子项1
   2. 有序子项2

### 混合内容

这里有**粗体**、*斜体*、\`行内代码\`和[链接](https://example.com)。

> 多行引用
> 第二行
> 第三行

---

完成。`, 'utf-8')
  
  console.log('\n✨ 所有测试fixtures生成完成！')
  console.log('\n📊 生成统计:')
  console.log(`   PDF文件: ${fs.readdirSync(path.join(FIXTURES_DIR, 'pdf')).length}个`)
  console.log(`   Word文件: ${fs.readdirSync(path.join(FIXTURES_DIR, 'docx')).length}个`)
  console.log(`   文本文件: ${fs.readdirSync(path.join(FIXTURES_DIR, 'text')).length}个`)
  
  // 计算总大小
  let totalSize = 0
  const countFiles = (dir: string) => {
    const files = fs.readdirSync(dir)
    files.forEach(file => {
      const filePath = path.join(dir, file)
      const stats = fs.statSync(filePath)
      totalSize += stats.size
    })
  }
  
  countFiles(path.join(FIXTURES_DIR, 'pdf'))
  countFiles(path.join(FIXTURES_DIR, 'docx'))
  countFiles(path.join(FIXTURES_DIR, 'text'))
  
  console.log(`   总大小: ${(totalSize / 1024 / 1024).toFixed(2)}MB`)
  
  console.log('\n📝 注意事项:')
  console.log('   1. 如果需要.doc旧格式文件，请手动创建或从Word另存为')
  console.log('   2. 加密PDF需要安装qpdf工具: brew install qpdf')
  console.log('   3. 所有文件已保存到 tests/fixtures/ 目录')
  console.log('\n🎯 下一步: 运行测试验证这些fixtures工作正常')
  console.log('   npm test -- parserService')
}

// 运行
main().catch(console.error)
