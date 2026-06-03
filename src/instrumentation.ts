// Track interval to prevent stacking on dev hot reloads (F6)
let scheduledInterval: ReturnType<typeof setInterval> | null = null

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Auto-checkout expired 24h sessions on startup
    try {
      const { autoCheckoutExpired } = await import('@/lib/autoCheckout')
      const result = await autoCheckoutExpired()
      if (result.count > 0) console.log(`[startup] Auto-checked-out ${result.count} expired session(s)`)
    } catch (e) {
      console.error('[startup] Auto-checkout cleanup failed:', e)
    }

    // Run startup backup
    try {
      const { runScheduledBackup } = await import('@/lib/backupScheduler')
      const result = await runScheduledBackup('STARTUP')
      if (result.success) console.log(`[startup] Backup created: ${result.fileName}`)
    } catch (e) {
      console.error('[startup] Backup failed:', e)
    }

    // F6: Clear existing interval before creating a new one (prevents stacking on dev hot reload)
    if (scheduledInterval) {
      clearInterval(scheduledInterval)
    }

    // Schedule auto-checkout + backup check every 60 seconds
    let lastBackupHour = -1
    scheduledInterval = setInterval(async () => {
      // Auto-checkout expired 24h sessions
      try {
        const { autoCheckoutExpired } = await import('@/lib/autoCheckout')
        const result = await autoCheckoutExpired()
        if (result.count > 0) {
          console.log(`[auto-checkout] Checked out ${result.count} expired session(s)`)
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
