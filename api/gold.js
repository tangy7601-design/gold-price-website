// api/gold.js
// 上海黄金交易所 Au99.99 最新行情接口
// 作用：
// 1. 请求上海黄金交易所行情数据
// 2. 从历史数据中找到最新一条有效 Au99.99 数据
// 3. 只返回最新价格，不把整份历史数据返回给前端

export default async function handler(req, res) {
  try {
    // =====================================================
    // 1. 请求上海黄金交易所行情数据
    // =====================================================

    const response = await fetch(
      'https://www.sge.com.cn/graph/Dailyhq',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
          'Referer': 'https://www.sge.com.cn/'
        },

        body: 'instid=Au99.99'
      }
    )

    // =====================================================
    // 2. 检查上海黄金交易所是否正常返回
    // =====================================================

    if (!response.ok) {
      throw new Error(
        `上海黄金交易所返回错误：${response.status}`
      )
    }

    // =====================================================
    // 3. 读取 JSON
    // =====================================================

    const data = await response.json()

    // =====================================================
    // 4. 检查是否存在行情数据
    // =====================================================

    if (
      !data ||
      !Array.isArray(data.time) ||
      data.time.length === 0
    ) {
      throw new Error('没有获取到 Au99.99 行情数据')
    }

    // =====================================================
    // 5. 找到最新一条有效行情
    //
    // 返回的数据类似：
    //
    // time: [
    //   ["2016-12-19", 262.45, 262.76, 262.02, 263.5],
    //   ["2016-12-20", 262.88, 262.06, 261.42, 263.7],
    //   ...
    // ]
    //
    // 第一项：日期
    // 后面的数字：对应当天行情数据
    //
    // 我们从后往前寻找最新的有效数据。
    // =====================================================

    let latestRecord = null

    for (let i = data.time.length - 1; i >= 0; i--) {
      const record = data.time[i]

      if (!Array.isArray(record) || record.length < 2) {
        continue
      }

      const date = record[0]

      // 从第二个元素开始寻找有效数字
      const numbers = record
        .slice(1)
        .filter(
          (value) =>
            typeof value === 'number' &&
            Number.isFinite(value) &&
            value > 0
        )

      if (numbers.length === 0) {
        continue
      }

      latestRecord = {
        date,
        numbers
      }

      break
    }

    // =====================================================
    // 6. 如果没有找到有效行情
    // =====================================================

    if (!latestRecord) {
      throw new Error('Au99.99 没有找到有效的最新行情')
    }

    // =====================================================
    // 7. 确定最新价格
    //
    // 上海黄金交易所这个数据接口不同版本返回字段
    // 可能存在一定差异。
    //
    // 我们这里优先使用最后一个有效价格。
    // =====================================================

    const price =
      latestRecord.numbers[
        latestRecord.numbers.length - 1
      ]

    // =====================================================
    // 8. 返回给前端
    // =====================================================

    return res.status(200).json({
      success: true,

      source: 'Shanghai Gold Exchange',

      product: 'Au99.99',

      currency: 'CNY',

      unit: 'RMB/gram',

      price: Number(price.toFixed(2)),

      date: latestRecord.date,

      updatedAt: new Date().toISOString()
    })
  } catch (error) {
    // =====================================================
    // 9. 出错处理
    // =====================================================

    console.error(
      'Au99.99 API Error:',
      error
    )

    return res.status(500).json({
      success: false,

      source: 'Shanghai Gold Exchange',

      product: 'Au99.99',

      error:
        error instanceof Error
          ? error.message
          : '获取 Au99.99 行情失败'
    })
  }
}