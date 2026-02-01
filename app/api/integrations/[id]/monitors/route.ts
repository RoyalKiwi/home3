/**
 * Integration Monitors API
 * GET: Fetch live monitor/container list from a specific integration (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { decrypt } from '@/lib/crypto';
import { requireAuth } from '@/lib/auth';
import { createDriver } from '@/lib/services/driverFactory';
import { UptimeKumaDriver } from '@/drivers/uptime-kuma';
import { UnraidDriver } from '@/drivers/unraid';
import type { Integration, IntegrationCredentials } from '@/lib/types';

/**
 * GET /api/integrations/:id/monitors
 * Fetches live monitor/container list from integration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const integrationId = parseInt(id, 10);

    if (isNaN(integrationId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid integration ID' },
        { status: 400 }
      );
    }
    const db = getDb();

    const integration = db
      .prepare('SELECT * FROM integrations WHERE id = ?')
      .get(integrationId) as Integration | undefined;

    if (!integration) {
      return NextResponse.json(
        { success: false, error: 'Integration not found' },
        { status: 404 }
      );
    }

    if (!integration.credentials) {
      return NextResponse.json(
        { success: false, error: 'Integration has no credentials configured' },
        { status: 400 }
      );
    }

    // Decrypt credentials
    const credentials = JSON.parse(
      decrypt(integration.credentials)
    ) as IntegrationCredentials;

    // Create driver
    const driver = createDriver(
      integration.id,
      integration.service_type,
      credentials
    );

    let monitors: Array<{ name: string; status: 'up' | 'down' }> = [];

    // Fetch monitors based on integration type
    if (integration.service_type === 'uptime-kuma') {
      monitors = await (driver as UptimeKumaDriver).fetchMonitorList();
    } else if (integration.service_type === 'unraid') {
      const dockerData = await (driver as UnraidDriver).fetchDocker();
      const containers = dockerData.metadata?.containers || [];

      monitors = containers.map((c: any) => ({
        name: c.name,
        status: c.state === 'running' ? ('up' as const) : ('down' as const),
      }));
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Integration type does not support monitor listing',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: monitors,
    });
  } catch (error) {
    console.error('[API] GET /api/integrations/:id/monitors error:', error);

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch monitors',
      },
      { status: 500 }
    );
  }
}
