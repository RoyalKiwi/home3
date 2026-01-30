import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { validateString } from '@/lib/validation';
import { extractDominantColors } from '@/lib/services/colorExtraction';
import { generateGradient } from '@/lib/services/gradientGenerator';

/**
 * POST /api/branding/gradient
 * Generate gradient from an existing icon path
 * Called by UI when user clicks "Generate Gradient" button
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();

    // Validate icon path
    const iconPath = validateString(body.icon_path, 'icon_path', 1, 500);

    console.log(`🎨 Generating gradient for: ${iconPath}`);

    // Convert API path (/api/data/cache/file.svg) to relative path (cache/file.svg)
    const relativePath = iconPath.replace('/api/data/', '');

    // Extract colors and generate gradient
    const dominantColors = await extractDominantColors(relativePath);
    const gradient = generateGradient(dominantColors);

    console.log(`✅ Gradient generated: ${gradient.join(', ')}`);

    return NextResponse.json({
      success: true,
      data: {
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

    console.error('Gradient generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate gradient. Please check that the icon path is valid.' },
      { status: 500 }
    );
  }
}
