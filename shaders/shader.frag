precision highp float;

const int MAX_LIGHTS = 8;

struct LightInfo {
    bool active;
    bool directional;
    vec3 pos;
    vec3 ia;
    vec3 id;
    vec3 is;
};

struct MaterialInfo {
    vec3 ka;
    vec3 kd;
    vec3 ks;
    float shininess;
};

varying vec3 fNormal;
varying vec3 posC;

uniform int uNLights; // Effective number of lights used

uniform LightInfo uLight[MAX_LIGHTS]; // The array of lights present in the scene
uniform MaterialInfo uMaterial;  // The material of the object being drawn

uniform mat4 mView;
uniform mat4 mViewNormals;

void main() {
    for(int i = 0; i < MAX_LIGHTS; i++) {
        if(i == uNLights) break; 

        if(uLight[i].active) {
            
            vec3 L;
            if(uLight[i].directional) {
                L = normalize((mViewNormals * vec4(uLight[i].pos, 0.0)).xyz);
            } else {
                L = normalize((mView * vec4(uLight[i].pos, 1.0)).xyz - posC);
            }

            vec3 V = normalize(-posC);
            vec3 N = normalize(fNormal);

            vec3 R = reflect(-L, N);

            float diffuseFactor = max(dot(N, L), 0.0);
            float specularFactor = pow(max(dot(R, V), 0.0), uMaterial.shininess);

            vec3 ambientColor = uLight[i].ia * uMaterial.ka;

            vec3 diffuseColor = uLight[i].id * uMaterial.kd;
            vec3 diffuse = diffuseFactor * diffuseColor;

            vec3 specularColor = uLight[i].is * uMaterial.ks;
            vec3 specular = specularFactor * specularColor;

            if(dot(L, N) < 0.0) {
                specular = vec3(0.0, 0.0, 0.0);
            }
            
            gl_FragColor.xyz += vec3(ambientColor + diffuse + specular);
        }  
    }
}