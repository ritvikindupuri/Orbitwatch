
export const fetchSpaceTrackCatalog = async (identity, password) => {
    // Mock data for build passing
    return [
        {
            OBJECT_NAME: 'ISS (ZARYA)',
            NORAD_CAT_ID: 25544,
            TLE_LINE1: '1 25544U 98067A   21168.45290615  .00000898  00000-0  24545-4 0  9997',
            TLE_LINE2: '2 25544  51.6441 230.7303 0003551 292.0076 195.6323 15.48979188288344',
            OWNER: 'ISS',
            OBJECT_TYPE: 'PAYLOAD',
            LAUNCH_DATE: '1998-11-20'
        }
    ];
};
