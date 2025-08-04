import pytest
import base64
import io
from PIL import Image
import numpy as np
from fastapi.testclient import TestClient
import sys
import os

# Add the parent directory to the path to import the app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the FastAPI app
from modal_sam2 import fastapi_app

client = TestClient(fastapi_app)

def create_test_image():
    """Create a simple test image"""
    # Create a 100x100 RGB image
    img_array = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    img = Image.fromarray(img_array)
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    return img_base64

def test_health_endpoint():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "endpoints" in data
    assert "version" in data

def test_segment_endpoint_missing_image():
    """Test segment endpoint with missing image data"""
    response = client.post("/segment", json={})
    assert response.status_code == 400
    assert "Image data is required" in response.json()["detail"]

def test_segment_endpoint_invalid_image():
    """Test segment endpoint with invalid image data"""
    response = client.post("/segment", json={
        "image_data": "invalid_base64_data"
    })
    assert response.status_code == 400

def test_generate_masks_endpoint_missing_image():
    """Test generate masks endpoint with missing image data"""
    response = client.post("/generate-masks", json={})
    assert response.status_code == 400
    assert "Image data is required" in response.json()["detail"]

def test_combine_masks_endpoint_missing_image():
    """Test combine masks endpoint with missing image data"""
    response = client.post("/combine-masks", json={
        "masks": ["mask1", "mask2"]
    })
    assert response.status_code == 400
    assert "Image data is required" in response.json()["detail"]

def test_combine_masks_endpoint_missing_masks():
    """Test combine masks endpoint with missing masks"""
    test_image = create_test_image()
    response = client.post("/combine-masks", json={
        "image_data": test_image,
        "masks": []
    })
    assert response.status_code == 400
    assert "At least one mask is required" in response.json()["detail"]

def test_paint_mask_endpoint_missing_image():
    """Test paint mask endpoint with missing image data"""
    response = client.post("/paint-mask", json={
        "mask": "test_mask",
        "color": "#FF0000"
    })
    assert response.status_code == 400
    assert "Image data is required" in response.json()["detail"]

def test_paint_mask_endpoint_missing_mask():
    """Test paint mask endpoint with missing mask"""
    test_image = create_test_image()
    response = client.post("/paint-mask", json={
        "image_data": test_image,
        "color": "#FF0000"
    })
    assert response.status_code == 400
    assert "Mask is required" in response.json()["detail"]

def test_paint_mask_endpoint_missing_color():
    """Test paint mask endpoint with missing color"""
    test_image = create_test_image()
    response = client.post("/paint-mask", json={
        "image_data": test_image,
        "mask": "test_mask"
    })
    assert response.status_code == 400
    assert "Color is required" in response.json()["detail"]

def test_paint_multiple_masks_endpoint_missing_image():
    """Test paint multiple masks endpoint with missing image data"""
    response = client.post("/paint-multiple-masks", json={
        "colored_masks": [{"mask": "test_mask", "color": "#FF0000"}]
    })
    assert response.status_code == 400
    assert "Image data is required" in response.json()["detail"]

def test_paint_multiple_masks_endpoint_missing_masks():
    """Test paint multiple masks endpoint with missing masks"""
    test_image = create_test_image()
    response = client.post("/paint-multiple-masks", json={
        "image_data": test_image,
        "colored_masks": []
    })
    assert response.status_code == 400
    assert "At least one colored mask is required" in response.json()["detail"]

def test_api_documentation():
    """Test that API documentation is accessible"""
    response = client.get("/docs")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]

def test_openapi_schema():
    """Test that OpenAPI schema is accessible"""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "openapi" in data
    assert "info" in data
    assert "paths" in data

if __name__ == "__main__":
    pytest.main([__file__]) 