# Image Generation Node
## What is an Image Generation Node?
The Image Generation Node is a powerful tool provided by the Magic Flow platform that automatically generates high-quality images based on your text descriptions (prompts). It's like communicating with a professional artist - you describe the scene you want, and the artist draws the corresponding image for you.

**Image Description:**

The Image Generation Node interface consists of a model selection area at the top and a parameter configuration area at the bottom. The top allows you to select different image generation models; the bottom allows you to set prompts (descriptions of the image you want), image size, aspect ratio, and other parameters.
![Image Generation Node](https://cdn.letsmagic.cn/static/img/Image-generation.png)

## Why do you need an Image Generation Node?
**In an intelligent workflow, you may need to:**
- Automatically generate product display images based on user descriptions
- Provide image resources for content creation, such as marketing posters, illustrations, etc.
- Provide visual image expressions for text content
- Quickly create prototype images or concept designs
The Image Generation Node helps you quickly obtain the required image resources through simple text descriptions without professional design skills, greatly improving work efficiency.

## Application Scenarios
### Scenario 1: Automatically Generate Product Display Images
When users describe the appearance of the product they want, the system can automatically generate product concept images that match the description, helping users understand the product more intuitively.

### Scenario 2: Content Creation Assistance
Automatically generate relevant image content for blog posts, social media posts, or marketing materials to enhance the attractiveness and expressiveness of the content.

### Scenario 3: Design Inspiration
Quickly generate multiple design options through text descriptions during the design process, serving as a source of inspiration or initial prototype.

## Node Parameter Description
### Input Parameters
|Parameter Name|Description|Required|Default Value|
|---|---|---|---|
|**Model**|Select the AI model used to generate images, different models have different styles and characteristics|Yes|Midjourney|
|**Prompt**|Describe the content of the image you want to generate, the more detailed the better|Yes|None|
|**Aspect Ratio**|Preset image aspect ratio, such as 1:1 (square), 16:9 (widescreen), etc.|No|1:1|
|**Reference Image**|Upload a reference image, AI will reference its style or content for creation|No|None|

### Output Description
|Parameter Name|Description|
|---|---|
|**Image URL (image_url)**|After the large model generates the image, it returns the corresponding image address|

## Usage Instructions
### Basic Configuration Steps
1. **Choose an appropriate model**:
    1. Midjourney series: Suitable for artistic styles, concept images, highly creative content
    2. Flux series: Suitable for realistic styles, product images, detailed illustrations
    3. Volcengine: Suitable for Chinese scenes, Eastern style images
2. **Write effective prompts**:
    1. Describe the image content, style, colors, etc. that you want in as much detail as possible
    2. Use specific adjectives to increase accuracy
    3. For example: "A golden Samoyed dog sitting on green grass, with blue sky and white clouds in the background, sunny, photo style"
3. **Set appropriate image parameters**: **Upload reference images** (optional):
    1. If you have a reference image with a specific style, you can upload it to help the AI better understand your needs

### Advanced Techniques
1. **Prompt Engineering**:
    1. Use artist names to guide style: "..., Van Gogh style", "..., cyberpunk style"
    2. Add medium descriptions to enhance effects: "oil painting", "watercolor", "photograph", "3D rendering"
2. **Aspect Ratio Selection**:
    1. Portraits are suitable for portrait ratios (such as 3:4)
    2. Landscapes are suitable for landscape ratios (such as 16:9)
    3. Product displays typically use square (1:1)
3. **Model Combination Usage**:
    1. First use Midjourney to generate creative concept images
    2. Then use the Flux series for refinement

## Precautions
### Generation Speed and Quality
Different models have different generation speeds and qualities:
- Midjourney-Turbo: Fastest speed, but relatively lower quality
- Midjourney-Relax: Moderate speed, good quality
- Flux1-Pro: Slower speed, but better details and quality
Please balance speed and quality according to actual needs.

### Content Restrictions
Image generation has certain content restrictions, and the following types of prompts may not generate corresponding images:
- Inappropriate content such as violence, pornography, etc.
- Content that infringes on others' portrait rights, copyrights
- Content containing politically sensitive information

### Resource Consumption
Image generation is a computationally intensive task that consumes more computing power and resources:
- The larger the size, the more resources consumed
- Enabling super-resolution significantly increases resource consumption
- High-quality models typically require more processing time

## Frequently Asked Questions
### Generated Image Does Not Match Description
**Problem**: I described a cat, but the generated image doesn't look like a cat.

**Solution**:
- Increase the specificity of the prompt, such as "an orange short-haired house cat with green eyes"
- Add more detailed descriptions, such as environment, posture, expression, etc.
- Try using enhancement words like "high quality, detailed"

### Poor Image Quality
**Problem**: The generated image is blurry or has obvious flaws.

**Solution**:
- Enable the "Super Resolution" option
- Add "blur, noise, distortion, low quality" to negative prompts
- Try using higher quality models (such as Flux1-Pro)
- Appropriately increase image size

### Cannot Generate Specific People or Brands
**Problem**: Cannot generate images of specific celebrities or commercial brands.

**Solution**:
- This is a content safety restriction of the system to protect portrait rights and intellectual property
- Try describing a general person with similar features, rather than a specific celebrity
- Describe abstract brand features rather than using specific brand names

## Common Node Combinations
|**Node Type**|**Combination Reason**|
|---|---|
|Large Model Call Node|Let the large model generate appropriate prompts based on user input, then pass to the Image Generation Node|
|Conditional Branch Node|Choose different prompts or models based on different conditions| 