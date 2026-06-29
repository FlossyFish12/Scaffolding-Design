import type { AccessType, LoadingClass, ScaffoldType } from '@prisma/client'

export function suggestScaffoldType(
  accessType: AccessType,
  loadingClass: LoadingClass,
): ScaffoldType {
  if (accessType === 'elevated') return 'cantilever'
  if (accessType === 'overhead') return 'suspended'
  if (accessType === 'confined') return 'birdcage'
  // ground
  return loadingClass === 'heavy' ? 'birdcage' : 'independent'
}
