import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { validateUrl } from '@/lib/validation';
import { fetchIconFromUrl } from '@/lib/services/branding';
import { extractDominantColors } from '@/lib/services/colorExtraction';
import { generateGradient } from '@/lib/services/gradientGenerator';

/**
 * POST /api/branding/fetch
 * Fetch icon from URL and return suggested gradient
 * (Gradient is returned as a suggestion, not auto-saved to card)
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth();

    const body = await request.json();

    // Validate URL
    const appUrl = validateUrl(body.url, 'url');

    console.log(`🎯 Fetching branding for: ${appUrl}`);

    // Step 1: Fetch icon from URL
    const iconPath = await fetchIconFromUrl(appUrl);

    if (!iconPath) {
      return NextResponse.json(
        { error: 'Failed to fetch icon from URL. Please try uploading manually.' },
        { status: 404 }
      );
    }

    // Step 2: Extract dominant colors
    // Convert API path (/api/data/cache/file.svg) to relative path (cache/file.svg)
    const relativePath = iconPath.replace('/api/data/', '');
    const dominantColors = await extractDominantColors(relativePath);

    // Step 3: Generate 4-color gradient
    const gradient = generateGradient(dominantColors);

    console.log(`✅ Branding fetch complete for ${appUrl}`);

    return NextResponse.json({
      success: true,
      data: {
        iconPath,
        gradient,
        dominantColors,
      },
    });
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (error.message && error.message.includes('must be')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('Branding fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding' },
      { status: 500 }
    );
  }
}
