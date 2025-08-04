#!/usr/bin/env python3
"""
Test script for SAM2 Building Painter Backend
Tests all major endpoints and functionality
"""

import asyncio
import httpx
import json
import base64
from PIL import Image
import io
import os
from typing import Dict, Any

# Test configuration
BASE_URL = "http://localhost:8000"
TEST_IMAGE_PATH = "test_image.jpg"

def create_test_image():
    """Create a simple test image"""
    # Create a simple 100x100 test image
    img = Image.new('RGB', (100, 100), color='white')
    
    # Draw a simple rectangle
    for x in range(30, 70):
        for y in range(30, 70):
            img.putpixel((x, y), (255, 0, 0))  # Red rectangle
    
    img.save(TEST_IMAGE_PATH)
    return TEST_IMAGE_PATH

def image_to_base64(image_path: str) -> str:
    """Convert image to base64"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode()

async def test_health_check():
    """Test health check endpoint"""
    print("🔍 Testing health check...")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/health")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed: {data['status']}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False

async def test_upload_image():
    """Test image upload endpoint"""
    print("📤 Testing image upload...")
    
    # Create test image
    test_image_path = create_test_image()
    
    async with httpx.AsyncClient() as client:
        with open(test_image_path, 'rb') as f:
            files = {'file': ('test_image.jpg', f, 'image/jpeg')}
            response = await client.post(f"{BASE_URL}/upload", files=files)
        
        if response.status_code == 200:
            data = response.json()
            session_id = data['session_id']
            print(f"✅ Upload successful: {session_id}")
            
            # Clean up test image
            os.remove(test_image_path)
            
            return session_id
        else:
            print(f"❌ Upload failed: {response.status_code} - {response.text}")
            return None

async def test_segment_image(session_id: str):
    """Test image segmentation"""
    print("🎯 Testing image segmentation...")
    
    # Test point-based segmentation
    payload = {
        "session_id": session_id,
        "points": [
            {"x": 50, "y": 50, "label": 1}  # Click in the middle
        ]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/segment", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Segmentation successful: mask size = {len(data['mask'])}")
            return True
        else:
            print(f"❌ Segmentation failed: {response.status_code} - {response.text}")
            return False

async def test_generate_masks(session_id: str):
    """Test mask generation"""
    print("🎭 Testing mask generation...")
    
    payload = {
        "session_id": session_id,
        "points_per_side": 16,  # Reduced for faster testing
        "pred_iou_thresh": 0.88,
        "stability_score_thresh": 0.95
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/generate-masks", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Mask generation successful: {data['total_masks']} masks generated")
            return data['masks']
        else:
            print(f"❌ Mask generation failed: {response.status_code} - {response.text}")
            return []

async def test_combine_masks(session_id: str, masks: list):
    """Test mask combination"""
    if not masks:
        print("⚠️ Skipping mask combination - no masks available")
        return False
    
    print("🔗 Testing mask combination...")
    
    # Combine first two masks if available
    mask_ids = [masks[0]['id']]
    if len(masks) > 1:
        mask_ids.append(masks[1]['id'])
    
    payload = {
        "session_id": session_id,
        "mask_ids": mask_ids
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/combine-masks", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Mask combination successful: {data['num_masks_combined']} masks combined")
            return True
        else:
            print(f"❌ Mask combination failed: {response.status_code} - {response.text}")
            return False

async def test_paint_mask(session_id: str, masks: list):
    """Test mask painting"""
    if not masks:
        print("⚠️ Skipping mask painting - no masks available")
        return False
    
    print("🎨 Testing mask painting...")
    
    payload = {
        "session_id": session_id,
        "mask_id": masks[0]['id'],
        "color": "#FF0000",
        "opacity": 0.7
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/paint-mask", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Mask painting successful: painted image size = {len(data['painted_image'])}")
            return True
        else:
            print(f"❌ Mask painting failed: {response.status_code} - {response.text}")
            return False

async def test_paint_multiple_masks(session_id: str, masks: list):
    """Test multiple mask painting"""
    if len(masks) < 2:
        print("⚠️ Skipping multiple mask painting - need at least 2 masks")
        return False
    
    print("🎨 Testing multiple mask painting...")
    
    payload = {
        "session_id": session_id,
        "colored_masks": [
            {"mask_id": masks[0]['id'], "color": "#FF0000", "opacity": 0.7},
            {"mask_id": masks[1]['id'], "color": "#00FF00", "opacity": 0.5}
        ]
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/paint-multiple-masks", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Multiple mask painting successful: {data['num_masks_painted']} masks painted")
            return True
        else:
            print(f"❌ Multiple mask painting failed: {response.status_code} - {response.text}")
            return False

async def test_download_image(session_id: str):
    """Test image download functionality"""
    print("📥 Testing image download...")
    
    # Test PNG download
    payload = {
        "session_id": session_id,
        "format": "PNG",
        "quality": 95
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/download-image", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ PNG download prepared: {data['image_url']}, size: {data['size_bytes']} bytes")
            
            # Test actual file download
            download_response = await client.get(f"{BASE_URL}{data['image_url']}")
            if download_response.status_code == 200:
                print(f"✅ File download successful: {len(download_response.content)} bytes")
                return True
            else:
                print(f"❌ File download failed: {download_response.status_code}")
                return False
        else:
            print(f"❌ Download preparation failed: {response.status_code} - {response.text}")
            return False

async def test_download_painted_image(session_id: str, masks: list):
    """Test painted image download functionality"""
    if not masks:
        print("⚠️ Skipping painted image download - no masks available")
        return False
    
    print("🎨 Testing painted image download...")
    
    payload = {
        "session_id": session_id,
        "mask_id": masks[0]['id'],
        "color": "#FF0000",
        "opacity": 0.7,
        "format": "JPG",
        "quality": 90
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{BASE_URL}/download-painted-image", json=payload)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Painted image download prepared: {data['image_url']}, size: {data['size_bytes']} bytes")
            
            # Test actual file download
            download_response = await client.get(f"{BASE_URL}{data['image_url']}")
            if download_response.status_code == 200:
                print(f"✅ Painted file download successful: {len(download_response.content)} bytes")
                return True
            else:
                print(f"❌ Painted file download failed: {download_response.status_code}")
                return False
        else:
            print(f"❌ Painted download preparation failed: {response.status_code} - {response.text}")
            return False

async def test_list_downloads():
    """Test download listing functionality"""
    print("📋 Testing download listing...")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/list-downloads")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Download listing successful: {data['total_files']} files available")
            return True
        else:
            print(f"❌ Download listing failed: {response.status_code} - {response.text}")
            return False

async def test_session_info(session_id: str):
    """Test session information retrieval"""
    print("ℹ️ Testing session info...")
    
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{BASE_URL}/session/{session_id}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Session info retrieved: {data['filename']}, {data['stored_masks']} masks")
            return True
        else:
            print(f"❌ Session info failed: {response.status_code} - {response.text}")
            return False

async def test_delete_session(session_id: str):
    """Test session deletion"""
    print("🗑️ Testing session deletion...")
    
    async with httpx.AsyncClient() as client:
        response = await client.delete(f"{BASE_URL}/session/{session_id}")
        
        if response.status_code == 200:
            print("✅ Session deletion successful")
            return True
        else:
            print(f"❌ Session deletion failed: {response.status_code} - {response.text}")
            return False

async def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting SAM2 Building Painter Backend Tests")
    print("=" * 50)
    
    # Test health check
    health_ok = await test_health_check()
    if not health_ok:
        print("❌ Health check failed - backend may not be running")
        return
    
    # Test upload
    session_id = await test_upload_image()
    if not session_id:
        print("❌ Upload failed - cannot continue tests")
        return
    
    # Test segmentation
    segment_ok = await test_segment_image(session_id)
    
    # Test mask generation
    masks = await test_generate_masks(session_id)
    
    # Test mask combination
    combine_ok = await test_combine_masks(session_id, masks)
    
    # Test mask painting
    paint_ok = await test_paint_mask(session_id, masks)
    
    # Test multiple mask painting
    multi_paint_ok = await test_paint_multiple_masks(session_id, masks)
    
    # Test download functionality
    download_ok = await test_download_image(session_id)
    download_painted_ok = await test_download_painted_image(session_id, masks)
    list_downloads_ok = await test_list_downloads()
    
    # Test session info
    info_ok = await test_session_info(session_id)
    
    # Test session deletion
    delete_ok = await test_delete_session(session_id)
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Summary:")
    print(f"✅ Health Check: {'PASS' if health_ok else 'FAIL'}")
    print(f"✅ Upload: {'PASS' if session_id else 'FAIL'}")
    print(f"✅ Segmentation: {'PASS' if segment_ok else 'FAIL'}")
    print(f"✅ Mask Generation: {'PASS' if masks else 'FAIL'}")
    print(f"✅ Mask Combination: {'PASS' if combine_ok else 'FAIL'}")
    print(f"✅ Mask Painting: {'PASS' if paint_ok else 'FAIL'}")
    print(f"✅ Multiple Mask Painting: {'PASS' if multi_paint_ok else 'FAIL'}")
    print(f"✅ Image Download: {'PASS' if download_ok else 'FAIL'}")
    print(f"✅ Painted Image Download: {'PASS' if download_painted_ok else 'FAIL'}")
    print(f"✅ Download Listing: {'PASS' if list_downloads_ok else 'FAIL'}")
    print(f"✅ Session Info: {'PASS' if info_ok else 'FAIL'}")
    print(f"✅ Session Deletion: {'PASS' if delete_ok else 'FAIL'}")
    
    # Overall result
    all_tests = [health_ok, session_id, segment_ok, masks, combine_ok, paint_ok, multi_paint_ok, 
                 download_ok, download_painted_ok, list_downloads_ok, info_ok, delete_ok]
    passed_tests = sum(1 for test in all_tests if test)
    total_tests = len(all_tests)
    
    print(f"\n🎯 Overall Result: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All tests passed! Backend is working correctly.")
    else:
        print("⚠️ Some tests failed. Check the logs above for details.")

if __name__ == "__main__":
    asyncio.run(run_all_tests()) 