export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { cleanupStaleSessions } = await import('@/lib/autoCheckout')

    // Cleanup stale sessions from previous days on startup
    try {
      const count = await cleanupStaleSessions()
      if (count > 0) console.log(`[startup] Auto-checked-out ${count} stale session(s)`)
    } catch (e) {
      console.error('[startup] Stale session cleanup failed:', e)
    }

    // Run startup backup
    try {
      const { runScheduledBackup } = await import('@/lib/backupScheduler')
      const result = await runScheduledBackup('STARTUP')
      if (result.success) console.log(`[startup] Backup created: ${result.fileName}`)
    } catch (e) {
      console.error('[startup] Backup failed:', e)
    }

    // Schedule backup + auto-checkout check every 60 seconds
    let lastBackupHour = -1
    setInterval(async () => {
      try {
        const { default: prisma } = await import('@/lib/prisma')
        const setting = await prisma.appSetting.findUnique({ where: { key: 'autoCheckoutTime' } })
        if (!setting?.value) return

        const now = new Date()
        const [h, m] = setting.value.split(':').map(Number)
        if (now.getHours() === h && now.getMinutes() === m) {
          const { autoCheckoutAll } = await import('@/lib/autoCheckout')
          const count = await autoCheckoutAll()
          if (count > 0) {
            console.log(`[auto-checkout] Checked out ${count} student(s) at ${setting.value}`)
          }
        }
      } catch (e) {
        console.error('[auto-checkout] Scheduled check failed:', e)
      }

      // Scheduled backup check
      try {
        const { default: prisma } = await import('@/lib/prisma')
        const freqSetting = await prisma.appSetting.findUnique({ where: { key: 'backupFrequencyHours' } })
        const retSetting = await prisma.appSetting.findUnique({ where: { key: 'backupRetentionDays' } })
        const freqHours = Number(freqSetting?.value) || 24
        const retDays = Number(retSetting?.value) || 30

        const now = new Date()
        const currentHour = now.getHours()
        if (currentHour !== lastBackupHour && currentHour % freqHours === 0) {
          lastBackupHour = currentHour
          const { runScheduledBackup, pruneOldBackups } = await import('@/lib/backupScheduler')
          const result = await runScheduledBackup('SCHEDULED')
          if (result.success) console.log(`[backup] Scheduled backup: ${result.fileName}`)
          const pruned = await pruneOldBackups(retDays)
          if (pruned > 0) console.log(`[backup] Pruned ${pruned} old backup(s)`)
        }
      } catch (e) {
        console.error('[backup] Scheduled backup failed:', e)
      }
    }, 60_000)
  }
}
