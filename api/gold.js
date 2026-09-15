// api/gold.js
// 上海黄金交易所 Au99.99 行情测试接口

export default async function handler(req, res) {
  try {
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

    if (!response.ok) {
      throw new Error(`上海黄金交易所返回错误：${response.status}`)
    }

    const data = await response.json()

    return res.status(200).json({
      success: true,
      source: 'Shanghai Gold Exchange',
      product: 'Au99.99',
      data
    })
  } catch (error) {
    console.error('Au99.99 API Error:', error)

    return res.status(500).json({
      success: false,
      source: 'Shanghai Gold Exchange',
      product: 'Au99.99',
      error: error.message
    })
  }
}