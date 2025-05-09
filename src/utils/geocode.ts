// src/utils/geocode.ts

import axios from "axios";
import type { IDeliveryAddress } from "../models/Order.model.js";
import config from "../config/env.js";
import logger from "../config/logger.js";

// Interface for the expected coordinates result
export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

// Interface for the feature object within Mapbox response
interface MapboxFeature {
  center: [number, number]; // [longitude, latitude]
  relevance: number;
  // Add other properties if needed (e.g., place_name, context)
}

// Interface for the Mapbox Geocoding API response structure
interface MapboxGeocodeResponse {
  features: MapboxFeature[];
  // Add other properties if needed (e.g., attribution)
}

/**
 * Geocodes a delivery address using the Mapbox Geocoding API.
 * Constructs a search query from the address components.
 *
 * @param addressObject - The delivery address object.
 * @returns A Promise resolving to GeocodeResult { latitude, longitude } or null if geocoding fails.
 */
export const geocodeAddress = async (
  addressObject: IDeliveryAddress
): Promise<GeocodeResult | null> => {
  const mapboxAccessToken = process.env.MAPBOX_ACCESS_TOKEN;

  if (!mapboxAccessToken) {
    console.error(
      "[Geocode] Error: MAPBOX_ACCESS_TOKEN environment variable is not set."
    );
    // Decide how to handle this: throw error or return null? Returning null might be safer.
    return null;
  }

  // Construct a search string from the address parts. More specific is better.
  // Prioritize parts likely to give good results (address, city, postalCode).
  const searchParts = [
    addressObject.address,
    addressObject.city,
    addressObject.postalCode,
    // Optionally add country for better accuracy if needed, e.g., 'Canada'
  ].filter(Boolean); // Remove any null/undefined/empty parts

  const searchText = searchParts.join(", ");

  if (!searchText.trim()) {
    console.warn("[Geocode] Warning: Address object is empty, cannot geocode.");
    return null;
  }

  // Encode the search text for the URL
  const encodedSearchText = encodeURIComponent(searchText);

  // Mapbox Geocoding API endpoint (v5)
  const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedSearchText}.json`;

  console.log(`[Geocode] Geocoding address: "${searchText}"`);

  try {
    const response = await axios.get<MapboxGeocodeResponse>(geocodeUrl, {
      params: {
        access_token: mapboxAccessToken,
        limit: 1, // We only need the most relevant result
        // Optional parameters for better results (check Mapbox docs):
        // country: 'CA', // Restrict search to Canada (use ISO 3166-1 codes)
        // proximity: 'ip', // Bias results towards user's IP (less useful for server)
        // types: 'address,postcode,place', // Limit result types if needed
      },
      timeout: 5000, // Set a timeout (e.g., 5 seconds)
    });

    // Check if features array exists and has results
    if (response.data?.features && response.data.features.length > 0) {
      const bestMatch = response.data.features[0];
      // Mapbox returns coordinates as [longitude, latitude]
      const [longitude, latitude] = bestMatch.center;

      // Optional: Check relevance score if needed (closer to 1 is better)
      // console.log(`[Geocode] Relevance score: ${bestMatch.relevance}`);

      if (typeof latitude === "number" && typeof longitude === "number") {
        console.log(
          `[Geocode] Success: Found coordinates (${latitude}, ${longitude})`
        );
        return { latitude, longitude };
      } else {
        console.warn(
          "[Geocode] Warning: Invalid coordinates received from Mapbox.",
          bestMatch.center
        );
        return null;
      }
    } else {
      console.warn(
        `[Geocode] Warning: No features found for address "${searchText}"`
      );
      return null; // Address likely not found or ambiguous
    }
  } catch (error: any) {
    console.error(
      `[Geocode] Error calling Mapbox API for address "${searchText}":`,
      error.response?.status, // Log HTTP status if available
      error.response?.data || error.message // Log Mapbox error message or general error
    );
    return null; // Return null on API error
  }
};
