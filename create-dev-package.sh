CURRENT_DIR="$(dirname $0)"
SRC_DIR="${CURRENT_DIR}/app"
DEST_DIR="${CURRENT_DIR}/build/dev"
VERSION=$(sed -n 's/"version": "\([^"]*\)",/\1/p' ${SRC_DIR}/manifest.json)
VERSION=${VERSION// /} #strip whitespace

echo "making build dir"
mkdir -p "${DEST_DIR}"
echo "copying files to build dir"
rsync -az "${SRC_DIR}/" "${DEST_DIR}/"

echo "removing key from manifest"
sed "/\"key\"/d" "${SRC_DIR}/manifest.json" > "${DEST_DIR}/manifest.json"
echo "creating into app-${VERSION}.zip"
zip -rq "app-${VERSION}.zip" "${DEST_DIR}"