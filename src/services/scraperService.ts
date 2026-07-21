// backend/src/services/scraperService.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Movie } from '../models/Movie';

export interface ScrapedMovie {
  _id?: string;
  title: string;
  description: string;
  posterUrl: string;
  coverUrl: string;
  sourceUrl: string;
  genres: string[];
  rating?: number;
}

/**
 * Resolves short links (boxd.it) or redirected URLs to the canonical Letterboxd URL.
 */
export const resolveCanonicalUrl = async (url: string): Promise<string> => {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      },
    });
    const $ = cheerio.load(response.data);
    const canonicalUrl = $('meta[property="og:url"]').attr('content');
    return canonicalUrl || response.request.res.responseUrl || url;
  } catch (error) {
    return url;
  }
};

/**
 * Extracts the film slug from a canonical Letterboxd URL.
 * Example: https://letterboxd.com/film/fight-club/ -> fight-club
 */
export const extractFilmSlug = (url: string): string | null => {
  const match = url.match(/\/film\/([^\/]+)/);
  return match ? match[1] : null;
};

/**
 * Fast preview scraper that extracts metadata and fetches the official poster URL
 * directly from Letterboxd's poster API endpoint.
 */
export const scrapeLetterboxdFastPreview = async (url: string): Promise<ScrapedMovie> => {
  const canonicalUrl = await resolveCanonicalUrl(url);

  // 1. DB Cache Check
  const cachedMovie = await Movie.findOne({ sourceUrl: canonicalUrl });
  if (cachedMovie && cachedMovie.posterUrl && cachedMovie.posterUrl.trim() !== '') {
    return {
      _id: (cachedMovie._id as string).toString(),
      title: cachedMovie.title,
      description: cachedMovie.description || '',
      posterUrl: cachedMovie.posterUrl,
      coverUrl: cachedMovie.coverUrl || '',
      sourceUrl: cachedMovie.sourceUrl || canonicalUrl,
      genres: cachedMovie.genres || [],
      rating: cachedMovie.rating,
    };
  }

  // 2. Fetch page HTML metadata
  try {
    const { data } = await axios.get(canonicalUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      },
    });

    const $ = cheerio.load(data);

    const title = $('meta[property="og:title"]').attr('content') || '';
    const description = $('meta[property="og:description"]').attr('content') || '';

    let coverUrl = $('meta[name="twitter:image"]').attr('content') || '';
    const backdropElement = $('.backdrop-wrapper');
    if (backdropElement.length > 0) {
      const backdropStyle = backdropElement.attr('style') || '';
      const match = backdropStyle.match(/url\(['"]?(.*?)['"]?\)/);
      if (match && match[1]) {
        coverUrl = match[1];
      }
    }

    const genres: string[] = [];
    $('#tab-panel-genres .text-sluglist a.text-slug[href*="genre"]').each((_, el) => {
      const genre = $(el).text().trim();
      if (genre) {
        genres.push(genre);
      }
    });

    const ratingContent = $('meta[name="twitter:data2"]').attr('content') || '';
    let rating: number | undefined = undefined;
    if (ratingContent) {
      const match = ratingContent.match(/^(\d+(\.\d+)?)/);
      if (match) {
        rating = parseFloat(match[1]);
      }
    }

    const cleanTitle = title.split(' - ')[0];

    // 3. Extract poster directly from Letterboxd poster endpoint
    let posterUrl = '';
    const slug = extractFilmSlug(canonicalUrl);

    if (slug) {
      try {
        const posterApiUrl = `https://letterboxd.com/film/${slug}/poster/std/230/`;
        const posterResponse = await axios.get<{ url?: string; url2x?: string }>(posterApiUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
          },
        });

        if (posterResponse.data) {
          // Prioritize url2x for higher resolution, fallback to url
          posterUrl = posterResponse.data.url2x || posterResponse.data.url || '';
        }
      } catch (posterError) {
        // Fallback to og:image if poster endpoint is unavailable
        posterUrl = $('meta[property="og:image"]').attr('content') || '';
      }
    }

    // 4. Save/Update record in MongoDB
    const updatedMovie = await Movie.findOneAndUpdate(
      { sourceUrl: canonicalUrl },
      {
        $set: {
          title: cleanTitle,
          description,
          posterUrl,
          coverUrl,
          sourceUrl: canonicalUrl,
          genres,
          rating,
        },
      },
      { new: true, upsert: true }
    );

    return {
      _id: (updatedMovie._id as string).toString(),
      title: updatedMovie.title,
      description: updatedMovie.description || '',
      posterUrl: updatedMovie.posterUrl || '',
      coverUrl: updatedMovie.coverUrl || '',
      sourceUrl: canonicalUrl,
      genres: updatedMovie.genres || [],
      rating: updatedMovie.rating,
    };
  } catch (error) {
    throw new Error('Failed to scrape fast preview data');
  }
};