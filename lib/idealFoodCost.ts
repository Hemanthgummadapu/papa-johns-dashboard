/**
 * Ideal Food Cost Calculator data — P3 2026.
 * Topping/specialty costs vary by size. Used by app/analytics/profitability Tool 3.
 */

export const IDEAL_FOOD_COST_P3_2026 = {
  period: 'P3-2026',
  cheeseCasePrice: 33.16,
  sizes: [
    '8"',
    '8" Par Bake',
    '10"',
    'Gluten Free',
    '12"',
    '12" Pan',
    '14"',
    'Thin',
    'NY Style 16"',
    '16"',
  ],
  toppingCosts: {
    'Pepperoni': { '8"': 0.1874, '8" Par Bake': 0.1874, '10"': 0.2342, 'Gluten Free': 0.2342, '12"': 0.3279, '12" Pan': 0.4919, '14"': 0.4919, 'Thin': 0.4919, 'NY Style 16"': 0.6324, '16"': 0.6324 },
    'Tomato (sliced)': { '8"': 0.218, '8" Par Bake': 0.218, '10"': 0.327, 'Gluten Free': 0.327, '12"': 0.4361, '12" Pan': 0.8721, '14"': 0.8721, 'Thin': 0.8721, 'NY Style 16"': 1.0902, '16"': 1.0902 },
    'Sausage': { '8"': 0.1755, '8" Par Bake': 0.1755, '10"': 0.2419, 'Gluten Free': 0.2419, '12"': 0.3628, '12" Pan': 0.4838, '14"': 0.4838, 'Thin': 0.4838, 'NY Style 16"': 0.6047, '16"': 0.6047 },
    'Italian Sausage': { '8"': 0.2021, '8" Par Bake': 0.2021, '10"': 0.2786, 'Gluten Free': 0.2786, '12"': 0.4178, '12" Pan': 0.5571, '14"': 0.5571, 'Thin': 0.5571, 'NY Style 16"': 0.6964, '16"': 0.6964 },
    'Beef': { '8"': 0.3851, '8" Par Bake': 0.3851, '10"': 0.6211, 'Gluten Free': 0.6211, '12"': 0.9317, '12" Pan': 1.2422, '14"': 1.2422, 'Thin': 1.2422, 'NY Style 16"': 1.5528, '16"': 1.5528 },
    'Philly Cheesesteak': { '8"': 0.6465, '8" Par Bake': 0.6465, '10"': 1.293, 'Gluten Free': 1.293, '12"': 1.724, '12" Pan': 3.4479, '14"': 3.4479, 'Thin': 3.4479, 'NY Style 16"': 3.4479, '16"': 3.4479 },
    'Mushrooms': { '8"': 0.1169, '8" Par Bake': 0.1169, '10"': 0.2224, 'Gluten Free': 0.2224, '12"': 0.3336, '12" Pan': 0.4448, '14"': 0.4448, 'Thin': 0.4448, 'NY Style 16"': 0.556, '16"': 0.556 },
    'Pineapple': { '8"': 0.1599, '8" Par Bake': 0.1599, '10"': 0.2256, 'Gluten Free': 0.2256, '12"': 0.3384, '12" Pan': 0.4512, '14"': 0.4512, 'Thin': 0.4512, 'NY Style 16"': 0.564, '16"': 0.564 },
    'Onions': { '8"': 0.1176, '8" Par Bake': 0.1176, '10"': 0.136, 'Gluten Free': 0.136, '12"': 0.204, '12" Pan': 0.2721, '14"': 0.2721, 'Thin': 0.2721, 'NY Style 16"': 0.3401, '16"': 0.3401 },
    'Green Peppers': { '8"': 0.13, '8" Par Bake': 0.13, '10"': 0.1552, 'Gluten Free': 0.1552, '12"': 0.2328, '12" Pan': 0.3104, '14"': 0.3104, 'Thin': 0.3104, 'NY Style 16"': 0.388, '16"': 0.388 },
    'Fresh Spinach': { '8"': 0.1472, '8" Par Bake': 0.1472, '10"': 0.2944, 'Gluten Free': 0.2944, '12"': 0.5888, '12" Pan': 0.8833, '14"': 0.8833, 'Thin': 0.8833, 'NY Style 16"': 1.1777, '16"': 1.1777 },
    'Anchovies': { '8"': 0.3723, '8" Par Bake': 0.3723, '10"': 0.5584, 'Gluten Free': 0.5584, '12"': 0.7446, '12" Pan': 0.7446, '14"': 0.7446, 'Thin': 0.7446, 'NY Style 16"': 0.9307, '16"': 0.9307 },
    'Black Olives': { '8"': 0.1419, '8" Par Bake': 0.1419, '10"': 0.1892, 'Gluten Free': 0.1892, '12"': 0.2837, '12" Pan': 0.3783, '14"': 0.3783, 'Thin': 0.3783, 'NY Style 16"': 0.4729, '16"': 0.4729 },
    'Jalapeno Peppers': { '8"': 0.0737, '8" Par Bake': 0.0737, '10"': 0.0982, 'Gluten Free': 0.0982, '12"': 0.1473, '12" Pan': 0.1964, '14"': 0.1964, 'Thin': 0.1964, 'NY Style 16"': 0.2455, '16"': 0.2455 },
    'Banana Peppers': { '8"': 0.0799, '8" Par Bake': 0.0799, '10"': 0.1066, 'Gluten Free': 0.1066, '12"': 0.1599, '12" Pan': 0.2132, '14"': 0.2132, 'Thin': 0.2132, 'NY Style 16"': 0.2665, '16"': 0.2665 },
    'Bacon': { '8"': 0.3052, '8" Par Bake': 0.3052, '10"': 0.4255, 'Gluten Free': 0.4255, '12"': 0.6382, '12" Pan': 0.851, '14"': 0.851, 'Thin': 0.851, 'NY Style 16"': 1.0637, '16"': 1.0637 },
    'Canadian Bacon': { '8"': 0.2164, '8" Par Bake': 0.2164, '10"': 0.3345, 'Gluten Free': 0.3345, '12"': 0.5018, '12" Pan': 0.6691, '14"': 0.6691, 'Thin': 0.6691, 'NY Style 16"': 0.8363, '16"': 0.8363 },
    'Chicken': { '8"': 0.4168, '8" Par Bake': 0.4168, '10"': 0.4752, 'Gluten Free': 0.4752, '12"': 0.7128, '12" Pan': 0.9504, '14"': 0.9504, 'Thin': 0.9504, 'NY Style 16"': 1.1879, '16"': 1.1879 },
    'Asiago/Fontina/Provolone': { '8"': 0.1189, '8" Par Bake': 0.1189, '10"': 0.1801, 'Gluten Free': 0.1801, '12"': 0.2701, '12" Pan': 0.3602, '14"': 0.3602, 'Thin': 0.3602, 'NY Style 16"': 0.4502, '16"': 0.4502 },
    'Parmesan/Romano': { '8"': 0.103, '8" Par Bake': 0.103, '10"': 0.1644, 'Gluten Free': 0.1644, '12"': 0.2465, '12" Pan': 0.3287, '14"': 0.3287, 'Thin': 0.3287, 'NY Style 16"': 0.4109, '16"': 0.4109 },
    'Cheese': { '8"': 0.2891, '8" Par Bake': 0.2891, '10"': 0.3782, 'Gluten Free': 0.3782, '12"': 0.5673, '12" Pan': 0.7565, '14"': 0.7565, 'Thin': 0.7565, 'NY Style 16"': 0.9456, '16"': 0.9456 },
    'Extra Cheese  2': { '8"': 0.0723, '8" Par Bake': 0.0723, '10"': 0.0946, 'Gluten Free': 0.0946, '12"': 0.1891, '12" Pan': 0.1891, '14"': 0.1891, 'Thin': 0.1891, 'NY Style 16"': 0.1891, '16"': 0.1891 },
    'Light Cheese  2': { '8"': -0.0723, '8" Par Bake': -0.0723, '10"': -0.0946, 'Gluten Free': -0.0946, '12"': -0.1891, '12" Pan': -0.1891, '14"': -0.1891, 'Thin': -0.1891, 'NY Style 16"': -0.1891, '16"': -0.1891 },
  },
  specialtyPizzas: {
    'The Works': { '8"': 1.6256, '8" Par Bake': 1.7934, '10"': 2.4211, 'Gluten Free': 4.3064, '12"': 3.2992, '12" Pan': 5.7205, '14"': 4.5622, 'Thin': 3.926, 'NY Style 16"': 5.6521, '16"': 6.1466 },
    'Garden Fresh': { '8"': 1.4593, '8" Par Bake': 1.6271, '10"': 2.1706, 'Gluten Free': 4.0559, '12"': 3.0106, '12" Pan': 5.2194, '14"': 4.0611, 'Thin': 3.4249, 'NY Style 16"': 4.9708, '16"': 5.4653 },
    'Tuscan Six Cheese': { '8"': 1.3645, '8" Par Bake': 1.5323, '10"': 2.0381, '12"': 2.8038, '12" Pan': 4.8827, '14"': 3.7831, 'Thin': 3.1469, 'NY Style 16"': 4.375, '16"': 4.8695 },
    'Fresh Spinach and Tomato Alfredo': { '8"': 1.8127, '8" Par Bake': 1.9805, '10"': 2.6941, 'Gluten Free': 4.6231, '12"': 3.6755, '12" Pan': 6.1947, '14"': 5.0951, 'Thin': 4.4589, 'NY Style 16"': 6.1286, '16"': 6.6231 },
    'BBQ Chicken & Bacon': { '8"': 1.7606, '8" Par Bake': 1.9284, '10"': 2.2919, 'Gluten Free': 4.2138, '12"': 3.2453, '12" Pan': 5.6408, '14"': 4.5412, 'Thin': 3.9051, 'NY Style 16"': 5.44, '16"': 5.9345 },
    'Meats': { '8"': 1.7279, '8" Par Bake': 1.8957, '10"': 2.5747, 'Gluten Free': 4.46, '12"': 3.3835, '12" Pan': 6.0277, '14"': 4.8693, 'Thin': 4.2331, 'NY Style 16"': 6.1129, '16"': 6.6074 },
    'Super Hawaiian': { '8"': 1.6748, '8" Par Bake': 1.8426, '10"': 2.4828, 'Gluten Free': 4.3697, '12"': 3.308, '12" Pan': 5.8438, '14"': 4.6855, 'Thin': 4.0488, 'NY Style 16"': 5.6647, '16"': 6.1592 },
    'Philly Cheesesteak': { '8"': 2.0192, '8" Par Bake': 2.1871, '10"': 3.3038, 'Gluten Free': 5.165, '12"': 4.4023, '12" Pan': 7.4857, '14"': 6.3274, 'Thin': 5.6912, 'NY Style 16"': 7.8543, '16"': 8.3488 },
    'Fiery Buffalo Chicken': { '8"': 1.7598, '8" Par Bake': 1.9276, '10"': 2.3486, 'Gluten Free': 4.216, '12"': 3.3093, '12" Pan': 5.7957, '14"': 4.6373, 'Thin': 4.0012, 'NY Style 16"': 5.5687, '16"': 6.0632 },
    'Shaq-a-Roni': { '16"': 4.4031 },
    'Ultimate Pepperoni': { '8"': 1.481, '8" Par Bake': 1.6489, '10"': 2.1394, 'Gluten Free': 4.0244, '12"': 2.9564, '12" Pan': 5.1796, '14"': 4.08, 'Thin': 3.4438, 'NY Style 16"': 4.6994, '16"': 5.1939 },
  },
  baseCosts: {
    '8"': 1.1165,
    '8" Par Bake': 1.2844,
    '10"': 1.6578,
    'Gluten Free': 3.5431,
    '12"': 2.2414,
    '12" Pan': 4.1938,
    '14"': 3.0355,
    'Thin': 2.3993,
    'NY Style 16"': 3.4324,
    '16"': 3.9269,
  },
} as const

/** Display sizes for the calculator (main crusts only). Maps to JSON size keys. */
export const IDEAL_SIZE_OPTIONS = [
  { key: '8"', label: '8"' },
  { key: '10"', label: '10"' },
  { key: '12"', label: '12"' },
  { key: '14"', label: '14"' },
  { key: '16"', label: '16"' },
] as const

/** Topping names that can be selected for Custom Pizza (excludes base/sauce/box/cheese-only). */
export const IDEAL_CUSTOM_TOPPING_NAMES = [
  'Pepperoni',
  'Sausage',
  'Italian Sausage',
  'Beef',
  'Chicken',
  'Bacon',
  'Canadian Bacon',
  'Mushrooms',
  'Pineapple',
  'Onions',
  'Green Peppers',
  'Fresh Spinach',
  'Black Olives',
  'Jalapeno Peppers',
  'Banana Peppers',
  'Tomato (sliced)',
  'Anchovies',
  'Asiago/Fontina/Provolone',
  'Parmesan/Romano',
  'Cheese',
  'Extra Cheese  2',
  'Light Cheese  2',
] as const

/** Specialty pizza names for the dropdown (excluding Shaq-a-Roni which is 16" only if we want to hide it, or include it). */
export const IDEAL_SPECIALTY_NAMES = [
  'Custom Pizza',
  'The Works',
  'Garden Fresh',
  'Tuscan Six Cheese',
  'Fresh Spinach and Tomato Alfredo',
  'BBQ Chicken & Bacon',
  'Meats',
  'Super Hawaiian',
  'Philly Cheesesteak',
  'Fiery Buffalo Chicken',
  'Ultimate Pepperoni',
  'Shaq-a-Roni',
] as const

export type IdealSizeKey = (typeof IDEAL_SIZE_OPTIONS)[number]['key']
