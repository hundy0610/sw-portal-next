export function convertToNotionProperties(body: Record<string, any>): Record<string, any> {
  const properties: Record<string, any> = {};

  for (const [key, value] of Object.entries(body)) {
    if (value === null || value === undefined) {
      continue;
    }

    switch (key) {
      case "사용자":
        properties[key] = {
          title: [
            {
              text: {
                content: String(value),
              },
            },
          ],
        };
        break;

      case "법인명":
      case "제조사":
      case "사용/재고/폐기/기타":
      case "반납사유":
        properties[key] = {
          select: {
            name: String(value),
          },
        };
        break;

      case "출고진행상황":
      case "반납 진행 상황":
      case "수리진행상황":
        properties[key] = {
          status: {
            name: String(value),
          },
        };
        break;

      case "수리 작업 유형":
      case "누락 사항":
        properties[key] = {
          multi_select: Array.isArray(value)
            ? value.map((item) => ({ name: String(item).trim() }))
            : String(value)
                .split(",")
                .map((item) => ({ name: item.trim() }))
                .filter((item) => item.name !== ""),
        };
        break;

      case "단가":
        properties[key] = {
          number: Number(value),
        };
        break;

      case "구매일자":
      case "사용일자":
      case "반납일자":
      case "수리일자":
        properties[key] = {
          date: {
            start: String(value),
          },
        };
        break;

      case "자산번호":
      case "부서":
      case "위치":
      case "모델명":
      case "시리얼 넘버":
      case "CPU":
      case "RAM":
      case "기타":
        properties[key] = {
          rich_text: [
            {
              text: {
                content: String(value),
              },
            },
          ],
        };
        break;

      case "수리담당자":
        properties[key] = {
          people: Array.isArray(value) ? value.map((id) => ({ id: String(id) })) : [{ id: String(value) }],
        };
        break;

      default:
        break;
    }
  }

  return properties;
}
