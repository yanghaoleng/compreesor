#!/usr/bin/env node

import { Command, Option } from 'commander'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import {
  compressFile,
  collectMediaFiles,
  formatBytes,
} from '../src/core.js'

const program = new Command()

program
  .name('compreesor')
  .description('批量压缩和转换图片、SVG、GIF 与视频')
  .version('1.0.0')
  .argument('<inputs...>', '文件或文件夹，可一次传入多个')
  .addOption(new Option('-f, --format <format>', '输出格式').choices([
    'original', 'jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'mp4', 'mov', 'mp3',
  ]).default('original'))
  .option('-q, --quality <number>', '质量 1-100', '80')
  .option('-o, --output <directory>', '输出目录；默认写在源文件旁边')
  .option('-r, --replace', '成功后替换原文件')
  .option('-y, --yes', '跳过替换确认')
  .option('--no-recursive', '不递归查找子目录')
  .option('--ffmpeg <path>', '指定 FFmpeg 可执行文件')
  .action(async (inputs, options) => {
    const quality = Number.parseInt(options.quality, 10)
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
      program.error('--quality 必须是 1 到 100 之间的整数')
    }

    const files = await collectMediaFiles(inputs, { recursive: options.recursive })
    if (files.length === 0) {
      console.error('没有找到支持的文件。')
      process.exitCode = 1
      return
    }

    if (options.replace && !options.yes) {
      if (!stdin.isTTY) {
        program.error('非交互环境使用 --replace 时必须同时传入 --yes')
      }
      const prompt = createInterface({ input: stdin, output: stdout })
      const answer = await prompt.question(`将替换 ${files.length} 个源文件，继续？(y/N) `)
      prompt.close()
      if (!/^y(?:es)?$/i.test(answer.trim())) {
        console.log('已取消。')
        return
      }
    }

    let completed = 0
    let failed = 0
    let originalBytes = 0
    let outputBytes = 0

    for (const [index, file] of files.entries()) {
      const label = `[${index + 1}/${files.length}]`
      try {
        const result = await compressFile(file, {
          format: options.format,
          quality,
          outputDirectory: options.output,
          replace: Boolean(options.replace),
          ffmpegPath: options.ffmpeg,
        })
        completed += 1
        originalBytes += result.originalBytes
        outputBytes += result.outputBytes
        const saved = result.originalBytes > 0
          ? Math.max(0, Math.round((1 - result.outputBytes / result.originalBytes) * 100))
          : 0
        const detail = result.unchanged ? '已保留较小的原文件' : `减少 ${saved}%`
        console.log(`${label} ✓ ${result.outputPath} · ${detail}`)
      } catch (error) {
        failed += 1
        console.error(`${label} ✗ ${file} · ${error instanceof Error ? error.message : String(error)}`)
      }
    }

    const saved = originalBytes > 0 ? Math.max(0, Math.round((1 - outputBytes / originalBytes) * 100)) : 0
    console.log(`\n完成 ${completed} 个，失败 ${failed} 个 · ${formatBytes(originalBytes)} → ${formatBytes(outputBytes)} · 减少 ${saved}%`)
    if (failed > 0) process.exitCode = 1
  })

await program.parseAsync()
