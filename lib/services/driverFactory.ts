/**
 * Driver Factory
 * Creates driver instances based on integration type
 */

import { BaseDriver } from '@/drivers/base';
import { UptimeKumaDriver } from '@/drivers/uptime-kuma';
import { NetdataDriver } from '@/drivers/netdata';
import { UnraidDriver } from '@/drivers/unraid';
import type { IntegrationType, IntegrationCredentials } from '@/lib/types';

/**
 * Constructor type for driver classes
 */
type DriverConstructor = new (
  integrationId: number,
  credentials: IntegrationCredentials
) => BaseDriver;

/**
 * Driver registry mapping service types to driver classes
 */
const DRIVER_REGISTRY: Record<IntegrationType, DriverConstructor> = {
  'uptime-kuma': UptimeKumaDriver,
  'netdata': NetdataDriver,
  'unraid': UnraidDriver,
};

/**
 * Create a driver instance for an integration
 */
export function createDriver(
  integrationId: number,
  serviceType: IntegrationType,
  credentials: IntegrationCredentials
): BaseDriver {
  const DriverClass = DRIVER_REGISTRY[serviceType];

  if (!DriverClass) {
    throw new Error(`Unknown service type: ${serviceType}`);
  }

  return new DriverClass(integrationId, credentials);
}

/**
 * Get available integration types and their capabilities
 */
export function getAvailableIntegrations() {
  return Object.entries(DRIVER_REGISTRY).map(([type, DriverClass]) => {
    // Create temporary instance to get capabilities
    const tempDriver = new DriverClass(0, {} as any);

    return {
      type: type as IntegrationType,
      displayName: tempDriver.displayName,
      capabilities: tempDriver.getCapabilities(),
    };
  });
}
