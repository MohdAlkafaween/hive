// `tx` is Prisma's interactive-transaction client. Its exact type is a deeply nested
// generic (Omit<PrismaClient, ITXClientDenyList>) that varies with client extensions
// (e.g. the global `omit`), so `any` is the pragmatic choice here. Callers always pass
// the $transaction callback parameter.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateReceiptNumber(tx: any): Promise<string> {
  const setting = await tx.appSetting.findUnique({ where: { key: 'nextReceiptNumber' } })
  const nextNum = setting ? parseInt(setting.value) : 1
  const receiptNumber = `RCP-${String(nextNum).padStart(5, '0')}`
  await tx.appSetting.upsert({
    where: { key: 'nextReceiptNumber' },
    create: { key: 'nextReceiptNumber', value: String(nextNum + 1) },
    update: { value: String(nextNum + 1) },
  })
  return receiptNumber
}
