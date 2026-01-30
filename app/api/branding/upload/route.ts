import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { saveUploadedIcon } from '@/lib/services/branding';
import { extractDominantColors } from '@/lib/services/colorExtraction';
import { generateGradient } from '@/lib/services/gradientGenerator';

/**
 * POST /api/branding/upload
 * Upload a custom icon and return suggested gradient
 * (Gradient is returned as a suggestion, not auto-saved to card)
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/x-icon'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload PNG, JPG, SVG, or ICO.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    console.log(`📤 Uploading icon: ${file.name} (${file.size} bytes)`);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save uploaded file
    const iconPath = saveUploadedIcon(buffer, file.name);

    // Convert API path (/api/data/uploads/file.svg) to relative path (uploads/file.svg)
    const relativePath = iconPath.replace('/api/data/', '');

    // Extract colors and generate gradient
    const dominantColors = await extractDominantColors(relativePath);
    const gradient = generateGradient(dominantColors);

    console.log(`✅ Icon upload complete: ${iconPath}`);

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

    console.error('Icon upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload icon' },
      { status: 500 }
    );
  }
}
