attribute vec4 vPosition;
attribute vec4 vNormal;

uniform mat4 mModelView;
uniform mat4 mNormals;
uniform mat4 mProjection;

varying vec3 fNormal;
varying vec3 posC;

void main() {
    // Position in camera frame
    posC = (mModelView * vPosition).xyz;

    // Normal in camera frame
    fNormal = (mNormals * vNormal).xyz;

    gl_Position = mProjection * mModelView * vPosition;
}