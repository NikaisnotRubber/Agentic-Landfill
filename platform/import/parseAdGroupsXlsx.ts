import ExcelJS from "exceljs";

export type AdMemberRow = {
  groupName: string;
  adAccount: string;
  cn: string;
  mail: string;
  bu: string;
  bg: string;
};

const GROUP_LIST_SHEET = "群組清單";

export async function parseAdGroupsXlsx(filePath: string): Promise<AdMemberRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const members: AdMemberRow[] = [];

  for (const worksheet of workbook.worksheets) {
    if (worksheet.name === GROUP_LIST_SHEET) {
      continue;
    }

    const headerRow = worksheet.getRow(1);
    const headers = headerRow.values
      .slice(1)
      .map((value) => String(value ?? "").trim());

    const indexOf = (...names: string[]) => headers.findIndex((header) => names.includes(header));

    const groupIdx = indexOf("群組");
    const normalizedGroupIdx = groupIdx >= 0 ? groupIdx : indexOf("Group", "Group Name");
    const accountIdx = indexOf("AD Account");
    const cnIdx = indexOf("CN");
    const mailIdx = indexOf("Mail");
    const buIdx = indexOf("BU");
    const bgIdx = indexOf("BG");

    if (normalizedGroupIdx < 0 || accountIdx < 0) {
      continue;
    }

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const groupName = String(row.getCell(normalizedGroupIdx + 1).value ?? "").trim();
      const adAccount = String(row.getCell(accountIdx + 1).value ?? "").trim();
      if (!groupName || !adAccount) {
        return;
      }

      members.push({
        groupName,
        adAccount,
        cn: cnIdx >= 0 ? String(row.getCell(cnIdx + 1).value ?? "").trim() : "",
        mail: mailIdx >= 0 ? String(row.getCell(mailIdx + 1).value ?? "").trim() : "",
        bu: buIdx >= 0 ? String(row.getCell(buIdx + 1).value ?? "").trim() : "",
        bg: bgIdx >= 0 ? String(row.getCell(bgIdx + 1).value ?? "").trim() : "",
      });
    });
  }

  return members;
}
